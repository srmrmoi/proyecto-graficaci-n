import { Tria } from './Tria.js';
import { Obj3D } from './Obj3D.js';
import { Point2D } from './Point2D.js';
import { Tools2D } from './Tools2D.js';

export class Polygon3D{
  private nrs:number[];
  private a: number; b: number; c: number; h: number;
  private t: Tria[] = [];

  constructor(vnrs:Array<number>) {
    this.nrs = vnrs.slice();
  }

  getNrs():number[]{return this.nrs;}
  getA():number{return this.a;}
  getB():number{return this.b;}
  getC():number{return this.c;}
  getH(): number{ return this.h; }

  setAbch(a: number, b: number, c: number, h: number): void{
    this.a = a; this.b = b; this.c = c; this.h = h;
  }

  getT():Tria[] {return this.t;}

  triangulate(obj: Obj3D ):void{
    const vScr: Point2D[] = obj.getVScr();
    const vertices: number[] = [];

    // Clean repeated consecutive vertices while preserving the original order.
    for (let i = 0; i < this.nrs.length; i++) {
      const index = Math.abs(this.nrs[i]);
      if (!vScr[index]) continue;
      if (vertices.length === 0 || vertices[vertices.length - 1] !== index) {
        vertices.push(index);
      }
    }
    if (vertices.length > 2 && vertices[0] === vertices[vertices.length - 1]) {
      vertices.pop();
    }

    this.t = [];
    if (vertices.length < 3) return;

    let signedArea = 0;
    for (let i = 0; i < vertices.length; i++) {
      const p = vScr[vertices[i]];
      const q = vScr[vertices[(i + 1) % vertices.length]];
      signedArea += p.x * q.y - q.x * p.y;
    }
    const orientation = signedArea >= 0 ? 1 : -1;
    const remaining = vertices.slice();
    const epsilon = 1e-8;
    let guard = 0;

    const insideOrOn = (a: Point2D, b: Point2D, c: Point2D, p: Point2D): boolean => {
      return Tools2D.area2(a, b, p) * orientation >= -epsilon &&
             Tools2D.area2(b, c, p) * orientation >= -epsilon &&
             Tools2D.area2(c, a, p) * orientation >= -epsilon;
    };

    while (remaining.length > 3 && guard < vertices.length * vertices.length) {
      let earFound = false;

      for (let i = 0; i < remaining.length; i++) {
        const iPrev = remaining[(i + remaining.length - 1) % remaining.length];
        const iCurr = remaining[i];
        const iNext = remaining[(i + 1) % remaining.length];
        const a = vScr[iPrev], b = vScr[iCurr], c = vScr[iNext];

        if (Tools2D.area2(a, b, c) * orientation <= epsilon) continue;

        let containsVertex = false;
        for (let j = 0; j < remaining.length; j++) {
          const candidate = remaining[j];
          if (candidate === iPrev || candidate === iCurr || candidate === iNext) continue;
          if (insideOrOn(a, b, c, vScr[candidate])) {
            containsVertex = true;
            break;
          }
        }
        if (containsVertex) continue;

        this.t.push(new Tria(iPrev, iCurr, iNext));
        remaining.splice(i, 1);
        earFound = true;
        break;
      }

      if (!earFound) break;
      guard++;
    }

    if (remaining.length === 3) {
      const a = vScr[remaining[0]], b = vScr[remaining[1]], c = vScr[remaining[2]];
      if (Math.abs(Tools2D.area2(a, b, c)) > epsilon) {
        this.t.push(new Tria(remaining[0], remaining[1], remaining[2]));
      }
      return;
    }

    if (remaining.length >= 3) {
      for (let i = 1; i < remaining.length - 1; i++) {
        const a = vScr[remaining[0]], b = vScr[remaining[i]], c = vScr[remaining[i + 1]];
        if (Math.abs(Tools2D.area2(a, b, c)) > epsilon) {
          this.t.push(new Tria(remaining[0], remaining[i], remaining[i + 1]));
        }
      }
    }
  }
}
