import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { from, Subject } from 'rxjs';
import { bufferCount, filter, map, tap, throttleTime } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  @ViewChild('pathElement') pathEl: ElementRef;
  size = 125;
  magnificationRatio = 1;
  magnifiedSize = this.size * this.magnificationRatio;
  sampleRate = 1024;
  stepSize = (this.size * 2) / this.sampleRate;
  audioContext = new AudioContext();
  audioDataStream$ = new Subject();
  path$ = this.audioDataStream$.pipe(
    filter(s => typeof s !== 'undefined'),
    map((value: number) => value * this.magnifiedSize + this.size),
    bufferCount(this.sampleRate),
    map(values =>
      values
        .map((value: number, index) => [index * this.stepSize, value])
        .reduce(
          (acc, point, i, a) =>
            i === 0
              ? `M ${point[0]},${point[1]}`
              : `${acc} ${this.bezierCommand(point, i, a)}`,
          ''
        )
    )
  );

  ngOnInit() {
    navigator.getUserMedia(
      { audio: true },
      stream => {
        const source = this.audioContext.createMediaStreamSource(stream);
        const processor = this.audioContext.createScriptProcessor(1024, 1, 1);

        source.connect(processor);
        processor.connect(this.audioContext.destination);

        processor.onaudioprocess = e => {
          e.inputBuffer.getChannelData(0).forEach(dataPoint => {
            this.audioDataStream$.next(dataPoint);
          });
        };
      },
      err => {
        console.log('ERROR', err.message);
      }
    );

    this.path$.subscribe(path => {
      this.pathEl.nativeElement.setAttribute('d', path);
    });
  }

  line(pointA: number[], pointB: number[]) {
    const lengthX = pointB[0] - pointA[0];
    const lengthY = pointB[1] - pointA[1];
    return {
      length: Math.sqrt(Math.pow(lengthX, 2) + Math.pow(lengthY, 2)),
      angle: Math.atan2(lengthY, lengthX)
    };
  }

  controlPoint(current: number[], previous: any, next: any, reverse: boolean) {
    const p = previous || current;
    const n = next || current;
    const smoothing = 0.2;
    const o = this.line(p, n);
    const angle = o.angle + (reverse ? Math.PI : 0);
    const length = o.length * smoothing;
    const x = current[0] + Math.cos(angle) * length;
    const y = current[1] + Math.sin(angle) * length;
    return [x, y];
  }

  bezierCommand(point: number[], i: number, a: any[]) {
    const [cpsX, cpsY] = this.controlPoint(a[i - 1], a[i - 2], point, false);
    const [cpeX, cpeY] = this.controlPoint(point, a[i - 1], a[i + 1], true);
    return `C ${cpsX},${cpsY} ${cpeX},${cpeY} ${point[0]},${point[1]}`;
  }
}
