import { Point2D } from './Point2D.js';
import { Point3D } from './Point3D.js';
import { Polygon3D } from './Polygon3D.js';
var Obj3D = /** @class */ (function () {
    function Obj3D() {
        this.theta = 0.30;
        this.phi = 1.3;
        this.sunZ = 1 / Math.sqrt(3);
        this.sunY = this.sunZ;
        this.sunX = -this.sunZ;
        this.inprodMin = 1e30;
        this.inprodMax = -1e30;
        this.w = new Array(); // World coordinates
        this.polyList = new Array(); // Polygon3D objects 
        this.file = " ";
        this.indices = [];
        this.tind = 0; // File name
    }
    Obj3D.prototype.read = function (file) {
        var text = String(file == null ? '' : file)
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
            if (!this.readTextObject(text))
                return this.failing();
            this.shiftToOrigin();
            return true;
        }
        catch (error) {
            console.error('No se pudo interpretar el modelo:', error);
            return this.failing();
        }
    };
    Obj3D.prototype.getPolyList = function () { return this.polyList; };
    Obj3D.prototype.getFName = function () { return this.file; };
    Obj3D.prototype.getE = function () { return this.e; };
    Obj3D.prototype.getVScr = function () { return this.vScr; };
    Obj3D.prototype.getImgCenter = function () { return this.imgCenter; };
    Obj3D.prototype.getRho = function () { return this.rho; };
    Obj3D.prototype.getD = function () { return this.d; };
    Obj3D.prototype.failing = function () {
        return false;
    };
    Obj3D.prototype.numbersFrom = function (text) {
        var matches = text.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
        if (!matches)
            return [];
        var values = [];
        for (var i = 0; i < matches.length; i++) {
            var value = Number(matches[i]);
            if (isFinite(value))
                values.push(value);
        }
        return values;
    };
    Obj3D.prototype.addFace = function (indices) {
        if (indices.length < 2)
            return true;
        for (var i = 0; i < indices.length; i++) {
            var vertex = Math.abs(indices[i]);
            if (vertex === 0 || !this.w[vertex]) {
                console.warn('Se omitió una cara que usa un vértice inexistente:', vertex);
                return true;
            }
        }
        this.polyList.push(new Polygon3D(indices));
        return true;
    };
    Obj3D.prototype.readTextObject = function (text) {
        if (!text.trim())
            return false;
        var lines = text.split('\n');
        var legacyFaces = [];
        var objFaces = [];
        var inFaces = false;
        var nextVertex = 1;
        var vertexCount = 0;
        for (var lineNumber = 0; lineNumber < lines.length; lineNumber++) {
            var originalLine = lines[lineNumber];
            var line = originalLine.trim();
            if (!line || line.indexOf('//') === 0 || line.indexOf(';') === 0)
                continue;
            var faceHeader = line.match(/^(faces?|caras?)\s*:?\s*(.*)$/i);
            if (faceHeader) {
                inFaces = true;
                if (faceHeader[2])
                    legacyFaces.push(faceHeader[2]);
                continue;
            }
            if (/^(vertices?|puntos?)\s*:?\s*$/i.test(line))
                continue;
            // También admite archivos OBJ sencillos guardados como .txt.
            if (/^v\s+/i.test(line)) {
                var values_1 = this.numbersFrom(line.substring(1));
                if (values_1.length < 3)
                    return false;
                while (this.w[nextVertex])
                    nextVertex++;
                this.addVertex(nextVertex, values_1[0], values_1[1], values_1[2]);
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
            var values = this.numbersFrom(line);
            if (values.length < 4)
                continue;
            var index = values[0];
            if (index <= 0 || index % 1 !== 0)
                return false;
            this.addVertex(index, values[1], values[2], values[3]);
            this.indices.push(index);
            vertexCount++;
            if (index >= nextVertex)
                nextVertex = index + 1;
        }
        if (vertexCount === 0)
            return false;
        this.tind = this.indices.length;
        for (var i = 0; i < objFaces.length; i++) {
            var tokens = objFaces[i].split(/\s+/);
            var face = [];
            for (var j = 0; j < tokens.length; j++) {
                var first = tokens[j].split('/')[0];
                if (!first)
                    continue;
                var index = Number(first);
                if (!isFinite(index) || index % 1 !== 0 || index === 0)
                    return false;
                if (index < 0)
                    index = this.w.length + index;
                face.push(index);
            }
            if (!this.addFace(face))
                return false;
        }
        for (var i = 0; i < legacyFaces.length; i++) {
            var hash = legacyFaces[i].indexOf('#');
            var faceLine = hash >= 0 ? legacyFaces[i].substring(0, hash) : legacyFaces[i];
            var pieces = faceLine.split('.');
            for (var j = 0; j < pieces.length; j++) {
                var values = this.numbersFrom(pieces[j]);
                if (values.length === 0)
                    continue;
                var face = [];
                for (var k = 0; k < values.length; k++) {
                    if (values[k] % 1 !== 0 || values[k] === 0)
                        return false;
                    face.push(values[k]);
                }
                if (!this.addFace(face))
                    return false;
            }
        }
        return this.polyList.length > 0;
    };
    Obj3D.prototype.addVertex = function (i, x, y, z) {
        if (x < this.xMin)
            this.xMin = x;
        if (x > this.xMax)
            this.xMax = x;
        if (y < this.yMin)
            this.yMin = y;
        if (y > this.yMax)
            this.yMax = y;
        if (z < this.zMin)
            this.zMin = z;
        if (z > this.zMax)
            this.zMax = z;
        //if (i >= this.w.length) this.w.setSize(i + 1);
        //this.w.push(new Point3D(x, y, z));
        this.w[i] = new Point3D(x, y, z);
    };
    Obj3D.prototype.shiftToOrigin = function () {
        this.xMin = this.yMin = this.zMin = +1e30;
        this.xMax = this.yMax = this.zMax = -1e30;
        for (var i = 1; i < this.w.length; i++) {
            var point = this.w[i];
            if (!point)
                continue;
            if (point.x < this.xMin)
                this.xMin = point.x;
            if (point.x > this.xMax)
                this.xMax = point.x;
            if (point.y < this.yMin)
                this.yMin = point.y;
            if (point.y > this.yMax)
                this.yMax = point.y;
            if (point.z < this.zMin)
                this.zMin = point.z;
            if (point.z > this.zMax)
                this.zMax = point.z;
        }
        var xwC = 0.5 * (this.xMin + this.xMax);
        var ywC = 0.5 * (this.yMin + this.yMax);
        var zwC = 0.5 * (this.zMin + this.zMax);
        var n = this.w.length;
        for (var i = 1; i < n; i++) {
            if (this.w[i] != undefined) {
                this.w[i].x -= xwC;
                this.w[i].y -= ywC;
                this.w[i].z -= zwC;
            }
        }
        var dx = this.xMax - this.xMin, dy = this.yMax - this.yMin, dz = this.zMax - this.zMin;
        this.rhoMin = Math.max(0.001, 0.6 * Math.sqrt(dx * dx + dy * dy + dz * dz));
        this.rhoMax = 1000 * this.rhoMin;
        this.rho = 3 * this.rhoMin;
    };
    Obj3D.prototype.initPersp = function () {
        var costh = Math.cos(this.theta);
        var sinth = Math.sin(this.theta);
        var cosph = Math.cos(this.phi);
        var sinph = Math.sin(this.phi);
        this.v11 = -sinth;
        this.v12 = -cosph * costh;
        this.v13 = sinph * costh;
        this.v21 = costh;
        this.v22 = -cosph * sinth;
        this.v23 = sinph * sinth;
        this.v32 = sinph;
        this.v33 = cosph;
        this.v43 = -this.rho;
    };
    Obj3D.prototype.eyeAndScreen = function (dim) {
        this.initPersp();
        var n = this.w.length;
        this.e = new Array(n);
        this.vScr = new Array(n);
        var xScrMin = 1e30, xScrMax = -1e30, yScrMin = 1e30, yScrMax = -1e30;
        for (var i = 1; i < n; i++) {
            var P = this.w[i];
            if (P == undefined) {
                this.e[i] = undefined;
                this.vScr[i] = null;
            }
            else {
                var x = this.v11 * P.x + this.v21 * P.y;
                var y = this.v12 * P.x + this.v22 * P.y + this.v32 * P.z;
                var z = this.v13 * P.x + this.v23 * P.y + this.v33 * P.z + this.v43;
                var Pe = this.e[i] = new Point3D(x, y, z);
                var xScr = -Pe.x / Pe.z, yScr = -Pe.y / Pe.z;
                this.vScr[i] = new Point2D(xScr, yScr);
                if (xScr < xScrMin)
                    xScrMin = xScr;
                if (xScr > xScrMax)
                    xScrMax = xScr;
                if (yScr < yScrMin)
                    yScrMin = yScr;
                if (yScr > yScrMax)
                    yScrMax = yScr;
            }
        }
        var rangeX = xScrMax - xScrMin, rangeY = yScrMax - yScrMin;
        this.d = 0.95 * Math.min(dim.width / rangeX, dim.height / rangeY);
        this.imgCenter = new Point2D(this.d * (xScrMin + xScrMax) / 2, this.d * (yScrMin + yScrMax) / 2);
        for (var i = 1; i < n; i++) {
            if (this.vScr[i] != null) {
                this.vScr[i].x *= this.d;
                this.vScr[i].y *= this.d;
            }
        }
        return this.d * Math.max(rangeX, rangeY);
        // Maximum screen-coordinate range used in CvHLines for HP-GL
    };
    Obj3D.prototype.planeCoeff = function () {
        this.inprodMin = 1e30;
        this.inprodMax = -1e30;
        var nFaces = this.polyList.length;
        for (var j = 0; j < nFaces; j++) {
            var pol = this.polyList[j];
            var nrs = pol.getNrs();
            if (nrs.length < 3)
                continue;
            var iA = Math.abs(nrs[0]), // Possibly negative
            iB = Math.abs(nrs[1]), // for HLines.
            iC = Math.abs(nrs[2]);
            var A = this.e[iA], B = this.e[iB], C = this.e[iC];
            var u1 = B.x - A.x, u2 = B.y - A.y, u3 = B.z - A.z, v1 = C.x - A.x, v2 = C.y - A.y, v3 = C.z - A.z, a = u2 * v3 - u3 * v2, b = u3 * v1 - u1 * v3, c = u1 * v2 - u2 * v1, len = Math.sqrt(a * a + b * b + c * c), h = void 0;
            if (!isFinite(len) || len < 1e-12) {
                pol.setAbch(0, 0, 0, 0);
                continue;
            }
            a /= len;
            b /= len;
            c /= len;
            h = a * A.x + b * A.y + c * A.z;
            pol.setAbch(a, b, c, h);
            var normalSign = h <= 0 ? 1 : -1;
            var inprod = (a * normalSign) * this.sunX +
                (b * normalSign) * this.sunY +
                (c * normalSign) * this.sunZ;
            if (inprod < this.inprodMin)
                this.inprodMin = inprod;
            if (inprod > this.inprodMax)
                this.inprodMax = inprod;
        }
        this.inprodRange = this.inprodMax - this.inprodMin;
        if (!isFinite(this.inprodRange) || Math.abs(this.inprodRange) < 1e-9)
            this.inprodRange = 1;
    };
    Obj3D.prototype.vp = function (cv, dTheta, dPhi, fRho) {
        this.theta += dTheta;
        this.phi += dPhi;
        var rhoNew = fRho * this.rho;
        if (rhoNew >= this.rhoMin && rhoNew <= this.rhoMax)
            this.rho = rhoNew;
        else
            return false;
        cv.paint();
        return true;
    };
    Obj3D.prototype.colorCode = function (a, b, c) {
        var inprod = a * this.sunX + b * this.sunY + c * this.sunZ;
        var value = Math.round(((inprod - this.inprodMin) / this.inprodRange) * 255);
        return Math.max(0, Math.min(255, value));
    };
    return Obj3D;
}());
export { Obj3D };
