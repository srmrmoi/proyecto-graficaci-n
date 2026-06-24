import { Tria } from './Tria.js';
import { Tools2D } from './Tools2D.js';
var Polygon3D = /** @class */ (function () {
    function Polygon3D(vnrs) {
        this.t = [];
        this.nrs = vnrs.slice();
    }
    Polygon3D.prototype.getNrs = function () { return this.nrs; };
    Polygon3D.prototype.getA = function () { return this.a; };
    Polygon3D.prototype.getB = function () { return this.b; };
    Polygon3D.prototype.getC = function () { return this.c; };
    Polygon3D.prototype.getH = function () { return this.h; };
    Polygon3D.prototype.setAbch = function (a, b, c, h) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.h = h;
    };
    Polygon3D.prototype.getT = function () { return this.t; };
    Polygon3D.prototype.triangulate = function (obj) {
        var vScr = obj.getVScr();
        var vertices = [];
        // Clean repeated consecutive vertices while preserving the original order.
        for (var i = 0; i < this.nrs.length; i++) {
            var index = Math.abs(this.nrs[i]);
            if (!vScr[index])
                continue;
            if (vertices.length === 0 || vertices[vertices.length - 1] !== index) {
                vertices.push(index);
            }
        }
        if (vertices.length > 2 && vertices[0] === vertices[vertices.length - 1]) {
            vertices.pop();
        }
        this.t = [];
        if (vertices.length < 3)
            return;
        var signedArea = 0;
        for (var i = 0; i < vertices.length; i++) {
            var p = vScr[vertices[i]];
            var q = vScr[vertices[(i + 1) % vertices.length]];
            signedArea += p.x * q.y - q.x * p.y;
        }
        var orientation = signedArea >= 0 ? 1 : -1;
        var remaining = vertices.slice();
        var epsilon = 1e-8;
        var guard = 0;
        var insideOrOn = function (a, b, c, p) {
            return Tools2D.area2(a, b, p) * orientation >= -epsilon &&
                Tools2D.area2(b, c, p) * orientation >= -epsilon &&
                Tools2D.area2(c, a, p) * orientation >= -epsilon;
        };
        while (remaining.length > 3 && guard < vertices.length * vertices.length) {
            var earFound = false;
            for (var i = 0; i < remaining.length; i++) {
                var iPrev = remaining[(i + remaining.length - 1) % remaining.length];
                var iCurr = remaining[i];
                var iNext = remaining[(i + 1) % remaining.length];
                var a = vScr[iPrev], b = vScr[iCurr], c = vScr[iNext];
                if (Tools2D.area2(a, b, c) * orientation <= epsilon)
                    continue;
                var containsVertex = false;
                for (var j = 0; j < remaining.length; j++) {
                    var candidate = remaining[j];
                    if (candidate === iPrev || candidate === iCurr || candidate === iNext)
                        continue;
                    if (insideOrOn(a, b, c, vScr[candidate])) {
                        containsVertex = true;
                        break;
                    }
                }
                if (containsVertex)
                    continue;
                this.t.push(new Tria(iPrev, iCurr, iNext));
                remaining.splice(i, 1);
                earFound = true;
                break;
            }
            if (!earFound)
                break;
            guard++;
        }
        if (remaining.length === 3) {
            var a = vScr[remaining[0]], b = vScr[remaining[1]], c = vScr[remaining[2]];
            if (Math.abs(Tools2D.area2(a, b, c)) > epsilon) {
                this.t.push(new Tria(remaining[0], remaining[1], remaining[2]));
            }
            return;
        }
        if (remaining.length >= 3) {
            for (var i = 1; i < remaining.length - 1; i++) {
                var a = vScr[remaining[0]], b = vScr[remaining[i]], c = vScr[remaining[i + 1]];
                if (Math.abs(Tools2D.area2(a, b, c)) > epsilon) {
                    this.t.push(new Tria(remaining[0], remaining[i], remaining[i + 1]));
                }
            }
        }
    };
    return Polygon3D;
}());
export { Polygon3D };
