import { Point2D } from './Point2D.js';
import { Point3D } from './Point3D.js';
import { Polygon3D } from './Polygon3D.js';
import { Dimension } from './Dimension.js';

export class Obj3D{
   rho: number; d: number; theta: number = 0.30; phi: number = 1.3; rhoMin: number; rhoMax: number;
   xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number;
   v11: number; v12: number; v13: number; v21: number; v22: number; v23: number; v32: number;
   v33: number; v43: number; xe: number; ye: number; ze: number; objSize: number;
   private imgCenter: Point2D;
   private sunZ: number = 1 / Math.sqrt(3); sunY: number = this.sunZ; sunX: number = -this.sunZ;
   inprodMin: number = 1e30; inprodMax: number = -1e30; inprodRange: number;
   public w:any[] = new Array();         // World coordinates
   private e:Array<Point3D>;                     // Eye coordinates
   private vScr: Array<Point2D>;//Point2D[];                  // Screen coordinates
   private polyList:any[] = new Array();  // Polygon3D objects 
   private file: string = " ";
   public indices:Array<number> = [];
	public tind:number=0;           // File name

   read(file: any): boolean {
      const text = String(file == null ? '' : file)
         .replace(/^\uFEFF/, '')
         .replace(/\r\n?/g, '\n');

      this.file = text;
      this.w = [];
      this.polyList = [];
      this.indices = [];
      this.tind = 0;
      this.xMin = this.yMin = this.zMin = +1e30;
      this.xMax = this.yMax = this.zMax = -1e30;

      try {
         if (!this.readTextObject(text)) return this.failing();
         this.shiftToOrigin();
         return true;
      } catch (error) {
         console.error('No se pudo interpretar el modelo:', error);
         return this.failing();
      }
   }

   getPolyList():any{return this.polyList;}
   getFName():string {return this.file;}
   getE():Point3D[] {return this.e;}
   getVScr():Point2D[] {return this.vScr;}
   getImgCenter():Point2D {return this.imgCenter;}
   getRho():number{return this.rho;}
   getD():number{return this.d;}

   failing(): boolean {
      return false;
   }

   private numbersFrom(text: string): number[] {
      const matches = text.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
      if (!matches) return [];
      const values: number[] = [];
      for (let i = 0; i < matches.length; i++) {
         const value = Number(matches[i]);
         if (isFinite(value)) values.push(value);
      }
      return values;
   }

   private addFace(indices: number[]): boolean {
      if (indices.length < 2) return true;

      for (let i = 0; i < indices.length; i++) {
         const vertex = Math.abs(indices[i]);
         if (vertex === 0 || !this.w[vertex]) {
            console.warn('Se omitió una cara que usa un vértice inexistente:', vertex);
            return true;
         }
      }

      this.polyList.push(new Polygon3D(indices));
      return true;
   }

   private readTextObject(text: string): boolean {
      if (!text.trim()) return false;

      const lines = text.split('\n');
      const legacyFaces: string[] = [];
      const objFaces: string[] = [];
      let inFaces = false;
      let nextVertex = 1;
      let vertexCount = 0;

      for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
         const originalLine = lines[lineNumber];
         let line = originalLine.trim();
         if (!line || line.indexOf('//') === 0 || line.indexOf(';') === 0) continue;

         const faceHeader = line.match(/^(faces?|caras?)\s*:?\s*(.*)$/i);
         if (faceHeader) {
            inFaces = true;
            if (faceHeader[2]) legacyFaces.push(faceHeader[2]);
            continue;
         }
         if (/^(vertices?|puntos?)\s*:?\s*$/i.test(line)) continue;

         // También admite archivos OBJ sencillos guardados como .txt.
         if (/^v\s+/i.test(line)) {
            const values = this.numbersFrom(line.substring(1));
            if (values.length < 3) return false;
            while (this.w[nextVertex]) nextVertex++;
            this.addVertex(nextVertex, values[0], values[1], values[2]);
            this.indices.push(nextVertex);
            nextVertex++;
            vertexCount++;
            continue;
         }

         if (/^f\s+/i.test(line)) {
            objFaces.push(line.substring(1).trim());
            inFaces = true;
            continue;
         }

         if (inFaces) {
            legacyFaces.push(line);
            continue;
         }

         line = line.replace(/\/\/.*$/, '').replace(/[,;]/g, ' ');
         const values = this.numbersFrom(line);
         if (values.length < 4) continue;

         const index = values[0];
         if (index <= 0 || index % 1 !== 0) return false;
         this.addVertex(index, values[1], values[2], values[3]);
         this.indices.push(index);
         vertexCount++;
         if (index >= nextVertex) nextVertex = index + 1;
      }

      if (vertexCount === 0) return false;
      this.tind = this.indices.length;

      for (let i = 0; i < objFaces.length; i++) {
         const tokens = objFaces[i].split(/\s+/);
         const face: number[] = [];
         for (let j = 0; j < tokens.length; j++) {
            const first = tokens[j].split('/')[0];
            if (!first) continue;
            let index = Number(first);
            if (!isFinite(index) || index % 1 !== 0 || index === 0) return false;
            if (index < 0) index = this.w.length + index;
            face.push(index);
         }
         if (!this.addFace(face)) return false;
      }

      for (let i = 0; i < legacyFaces.length; i++) {
         const hash = legacyFaces[i].indexOf('#');
         const faceLine = hash >= 0 ? legacyFaces[i].substring(0, hash) : legacyFaces[i];
         const pieces = faceLine.split('.');
         for (let j = 0; j < pieces.length; j++) {
            const values = this.numbersFrom(pieces[j]);
            if (values.length === 0) continue;
            const face: number[] = [];
            for (let k = 0; k < values.length; k++) {
               if (values[k] % 1 !== 0 || values[k] === 0) return false;
               face.push(values[k]);
            }
            if (!this.addFace(face)) return false;
         }
      }

      return this.polyList.length > 0;
   }

   addVertex(i: number, x: number, y: number, z: number): void{
      if (x < this.xMin) this.xMin = x; if (x > this.xMax) this.xMax = x;
      if (y < this.yMin) this.yMin = y; if (y > this.yMax) this.yMax = y;
      if (z < this.zMin) this.zMin = z; if (z > this.zMax) this.zMax = z;
      //if (i >= this.w.length) this.w.setSize(i + 1);
      //this.w.push(new Point3D(x, y, z));
      this.w[i] = new Point3D(x, y, z);
   }

   shiftToOrigin() :void{
      this.xMin = this.yMin = this.zMin = +1e30;
      this.xMax = this.yMax = this.zMax = -1e30;
      for (let i = 1; i < this.w.length; i++) {
         const point = this.w[i];
         if (!point) continue;
         if (point.x < this.xMin) this.xMin = point.x;
         if (point.x > this.xMax) this.xMax = point.x;
         if (point.y < this.yMin) this.yMin = point.y;
         if (point.y > this.yMax) this.yMax = point.y;
         if (point.z < this.zMin) this.zMin = point.z;
         if (point.z > this.zMax) this.zMax = point.z;
      }

      let xwC = 0.5 * (this.xMin + this.xMax);
      let ywC = 0.5 * (this.yMin + this.yMax);
      let zwC = 0.5 * (this.zMin + this.zMax);
      let n = this.w.length;
      for (let i = 1; i < n; i++){
         if (this.w[i] != undefined) {
            this.w[i].x -= xwC;
            this.w[i].y -= ywC;
            this.w[i].z -= zwC;
         }
      }
      let dx = this.xMax - this.xMin, dy = this.yMax - this.yMin, dz = this.zMax - this.zMin;
      this.rhoMin = Math.max(0.001, 0.6 * Math.sqrt(dx * dx + dy * dy + dz * dz));
      this.rhoMax = 1000 * this.rhoMin;
      this.rho = 3 * this.rhoMin;
   }

   initPersp(): void {
      let costh = Math.cos(this.theta);
      let sinth = Math.sin(this.theta);
      let cosph = Math.cos(this.phi);
      let sinph = Math.sin(this.phi);
         this.v11 = -sinth; this.v12 = -cosph * costh; this.v13 = sinph * costh;
         this.v21 = costh;  this.v22 = -cosph * sinth; this.v23 = sinph * sinth;
                            this.v32 = sinph;          this.v33 = cosph;
                                                       this.v43 = -this.rho;
   }

   eyeAndScreen(dim: Dimension ): number{// Called in paint method of Canvas class
      this.initPersp();
      let n = this.w.length;
      this.e = new Array(n);
      this.vScr = new Array(n);
      let xScrMin=1e30, xScrMax=-1e30,
            yScrMin=1e30, yScrMax=-1e30;
      for (let i = 1; i < n; i++) {
         let P: Point3D = this.w[i];
         if (P == undefined) {
            this.e[i] = undefined; this.vScr[i] = null;
         }
         else {
            let x = this.v11 * P.x + this.v21 * P.y;
            let y = this.v12 * P.x + this.v22 * P.y + this.v32 * P.z;
            let z = this.v13 * P.x + this.v23 * P.y + this.v33 * P.z + this.v43;
            let Pe:Point3D = this.e[i] = new Point3D(x, y, z);
            let xScr = -Pe.x/Pe.z, yScr = -Pe.y/Pe.z;
            this.vScr[i] = new Point2D(xScr, yScr);
            if (xScr < xScrMin) xScrMin = xScr; 
            if (xScr > xScrMax) xScrMax = xScr;
            if (yScr < yScrMin) yScrMin = yScr;
            if (yScr > yScrMax) yScrMax = yScr;
         }
      }
      let rangeX = xScrMax - xScrMin, rangeY = yScrMax - yScrMin;
      this.d = 0.95 * Math.min(dim.width/rangeX, dim.height/rangeY);
      this.imgCenter = new Point2D(this.d * (xScrMin + xScrMax)/2,
                              this.d * (yScrMin + yScrMax)/2);
      for (let i = 1; i < n; i++) {
         if (this.vScr[i] != null) { this.vScr[i].x *= this.d; this.vScr[i].y *= this.d; }
      }
      return this.d * Math.max(rangeX, rangeY);
      // Maximum screen-coordinate range used in CvHLines for HP-GL
   }

   planeCoeff(): void {
      this.inprodMin = 1e30;
      this.inprodMax = -1e30;
      let nFaces = this.polyList.length;

      for (let j = 0; j < nFaces; j++){
         let pol: Polygon3D  = this.polyList[j];
         let nrs: number[] = pol.getNrs();
         if (nrs.length < 3) continue;
         let iA = Math.abs(nrs[0]), // Possibly negative
             iB = Math.abs(nrs[1]), // for HLines.
            iC = Math.abs(nrs[2]);
         let A: Point3D  = this.e[iA], B: Point3D = this.e[iB], C: Point3D = this.e[iC];
         let 
            u1 = B.x - A.x, u2 = B.y - A.y, u3 = B.z - A.z,
            v1 = C.x - A.x, v2 = C.y - A.y, v3 = C.z - A.z,
            a = u2 * v3 - u3 * v2,
            b = u3 * v1 - u1 * v3,
            c = u1 * v2 - u2 * v1,
            len = Math.sqrt(a * a + b * b + c * c), h;
         if (!isFinite(len) || len < 1e-12) {
            pol.setAbch(0, 0, 0, 0);
            continue;
         }
         a /= len; b /= len; c /= len;
         h = a * A.x + b * A.y + c * A.z;
         pol.setAbch(a, b, c, h);

         const normalSign = h <= 0 ? 1 : -1;
         let inprod: number = (a * normalSign) * this.sunX +
                              (b * normalSign) * this.sunY +
                              (c * normalSign) * this.sunZ;
         if (inprod < this.inprodMin) this.inprodMin = inprod; 
         if (inprod > this.inprodMax) this.inprodMax = inprod;
      }
      this.inprodRange = this.inprodMax - this.inprodMin;
      if (!isFinite(this.inprodRange) || Math.abs(this.inprodRange) < 1e-9)
         this.inprodRange = 1;
   }

   vp(cv: { paint(): void }, dTheta:number, dPhi:number, fRho:number): boolean {
      this.theta += dTheta;
      this.phi += dPhi;
      let rhoNew = fRho * this.rho;
      if (rhoNew >= this.rhoMin && rhoNew <= this.rhoMax)
         this.rho = rhoNew;
      else
         return false;
      cv.paint();
      return true;
   }

   colorCode(a: number, b: number, c: number): number{
      let inprod = a * this.sunX + b * this.sunY + c * this.sunZ;
      const value = Math.round(((inprod - this.inprodMin)/this.inprodRange) * 255);
      return Math.max(0, Math.min(255, value));
   }
}