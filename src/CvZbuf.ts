// CvHbuff: Used in the file Zbuff visor.
import { Obj3D } from './Obj3D.js';
import { Point2D } from './Point2D.js';
import { Dimension } from './Dimension.js';
import { Polygon3D } from './Polygon3D.js';
import { Point3D } from './Point3D.js';
import { Tria } from './Tria.js'
import { Tools2D } from './Tools2D.js'
export class CvZbuf{ //extends Canvas3D {
  private maxX: number; maxY: number; centerX: number; centerY: number; maxX0 = -1; maxY0 = -1;
  private buf: number[][];
  private obj: Obj3D;
  private imgCenter: Point2D;
  private g: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;

  constructor(g: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    this.g = g;
    this.canvas = canvas;
  }
  
  iX(x: number): number{return Math.round(this.centerX + x - this.imgCenter.x);}
  iY(y: number): number{ return Math.round(this.centerY - y + this.imgCenter.y);}
  
  getObj(): Obj3D { return this.obj; }
  setObj(obj: Obj3D ):void {this.obj = obj;}
  
  paint(): void{
    if (this.obj == undefined) return;
    let polyList:Array<Polygon3D> = this.obj.getPolyList();
    if (polyList == undefined) return;
    let nFaces: number = polyList.length;
    if (nFaces == 0) return;
    //let xe:number, ye:number, ze:number;
    let dim: Dimension = new Dimension(this.canvas.width, this.canvas.height);
    this.canvas.width=this.canvas.width;
    this.maxX = dim.width - 1; this.maxY = dim.height - 1;
    this.centerX = this.maxX/2; this.centerY = this.maxY/2;
      // ze-axis towards eye, so ze-coordinates of
      // object points are all negative. Since screen
      // coordinates x and y are used to interpolate for
      // the z-direction, we have to deal with 1/z instead
      // of z. With negative z, a small value of 1/z means
      // a small value of |z| for a nearby point. We there-
      // fore begin with large buffer values 1e30:
    if (this.maxX != this.maxX0 || this.maxY != this.maxY0) {
      //buf = new float[dim.width][dim.height];
      this.buf = new Array(dim.width);
      for (let i = 0; i < dim.width; i++) 
        this.buf[i] = new Array(dim.height);
      this.maxX0 = this.maxX; this.maxY0 = this.maxY;
    }
    for (let iy=0; iy<dim.height; iy++)
      for (let ix = 0; ix < dim.width; ix++)
        this.buf[ix][iy] = 1e30;

    this.obj.eyeAndScreen(dim);
    this.imgCenter = this.obj.getImgCenter();
    this.obj.planeCoeff(); // Compute a, b, c and h.
    let e: Point3D[] = this.obj.getE();
    let vScr: Point2D[]  = this.obj.getVScr();

    for (let j = 0; j < nFaces; j++) {  
      let pol: Polygon3D = polyList[j];
    if (pol.getNrs().length < 3) continue;
    const normalSign = pol.getH() <= 0 ? 1 : -1;
    let cCode = this.obj.colorCode(
      pol.getA() * normalSign,
      pol.getB() * normalSign,
      pol.getC() * normalSign
    );
    const light = Math.max(0, Math.min(255, cCode));
    const red = Math.round(28 + light * 0.22);
    const green = Math.round(92 + light * 0.42);
    const blue = Math.round(150 + light * 0.38);
    this.g.strokeStyle = `rgb(${red},${green},${blue})`;
    this.g.fillStyle = `rgb(${red},${green},${blue})`;
    this.g.lineWidth = 1;
    pol.triangulate(this.obj);

    let t: Tria[] = pol.getT();
      for (let i = 0; i < t.length; i++){  
      let tri: Tria  = t[i];
      let iA = tri.iA, iB = tri.iB, iC = tri.iC;
      let a: Point2D = vScr[iA], b: Point2D = vScr[iB], c: Point2D = vScr[iC];
      let zAi: number = 1/e[tri.iA].z, zBi: number = 1/e[tri.iB].z,
          zCi: number = 1/e[tri.iC].z;
      // We now compute the coefficients a, b and c
      // (written here as aa, bb and cc)
      // of the imaginary plane ax + by + czi = h,
      // where zi is 1/z (and x, y and z are
      // eye coordinates. Then we compute
      // the partial derivatives dzdx and dzdy:
      let u1 = b.x - a.x, v1 = c.x - a.x,
          u2 = b.y - a.y, v2 = c.y - a.y,
          cc=u1*v2-u2*v1;
      if (Math.abs(cc) < 1e-9) continue;
        let xA = a.x, yA = a.y,
          xB = b.x, yB = b.y,
          xC = c.x, yC = c.y,
          xD = (xA + xB + xC) / 3,
          yD = (yA + yB + yC) / 3,
          zDi = (zAi + zBi + zCi) / 3,
          u3 = zBi - zAi, v3 = zCi - zAi,
          aa = u2 * v3 - u3 * v2,
          bb = u3 * v1 - u1 * v3,
          dzdx = -aa / cc, dzdy = -bb / cc;
      let yBottomR = Math.min(yA, Math.min(yB, yC)),
          yTopR = Math.max(yA, Math.max(yB, yC));
      let yBottom = Math.ceil(yBottomR),
          yTop = Math.floor(yTopR);

      for (let y=yBottom; y<=yTop; y++){
          // Compute horizontal line segment (xL, xR)
         // for coordinate y:
        let xI: number, xJ: number, xK: number, xI1: number, xJ1: number,
            xK1: number, xL: number, xR: number;
        xI = xJ = xK = 1e30;
        xI1 = xJ1 = xK1 = -1e30;
        if((y-yB)*(y-yC)<=0&&yB!=yC)
          xI = xI1 = xC + (y - yC)/(yB - yC) * (xB - xC);
        if((y-yC)*(y-yA)<=0&&yC!=yA)
          xJ = xJ1 = xA + (y - yA)/(yC - yA) * (xC - xA);
        if((y-yA)*(y-yB)<=0&&yA!=yB)
           xK = xK1 = xB + (y - yB)/(yA - yB) * (xA - xB);
         // xL = xR = xI;
        xL = Math.min(xI, Math.min(xJ, xK));
        xR = Math.max(xI1, Math.max(xJ1, xK1));
        let iy = this.iY(y), iXL = this.iX((xL+0.5)),
            iXR = this.iX((xR-0.5));
        if (iy < 0 || iy > this.maxY) continue;
        iXL = Math.max(0, iXL);
        iXR = Math.min(this.maxX, iXR);
        if (iXL > iXR) continue;
        let zi = 1.01 * zDi + (y - yD) * dzdy +
                                 (xL - xD) * dzdx;
      /*
        for (int x=iXL; x<=iXR; x++)
         {  if (zi < buf[x][iy]) // < is nearer
            {  g.drawLine(x, iy, x, iy);
              buf[x][iy] = (float)zi;
            }
            zi += dzdx;
        }
      */
     //  The above comment fragment is optimized below:
     //  ---
        let leftmostValid: boolean = false;
        let xLeftmost: number = 0;
        for (let ix=iXL; ix<=iXR; ix++){
          if (zi < this.buf[ix][iy]){// < means nearer
            if (!leftmostValid){
              xLeftmost = ix;
              leftmostValid = true;
            }
            this.buf[ix][iy] = zi;
          }
          else
            if (leftmostValid) {
              this.drawLine(this.g, xLeftmost, iy, ix + 1, iy);
              leftmostValid = false;
            } 
            zi += dzdx;
          }
          if (leftmostValid)
            this.drawLine(this.g,xLeftmost, iy, iXR, iy);
         // ---
        }
      }
    }
  }
  drawLine(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void{
    //let x1 = this.iX(px1), y1 = this.iY(py1), x2 = this.iX(px2), y2 = this.iY(py2);
      if (x1 != x2 || y1 != y2) {
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.closePath();
        g.stroke();
      } 
    }
}