class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    add(v) { return new Vector(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector(this.x - v.x, this.y - v.y); }
    mult(n) { return new Vector(this.x * n, this.y * n); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() {
        const m = this.mag();
        return m === 0 ? new Vector(0, 0) : new Vector(this.x / m, this.y / m);
    }
    dot(v) { return this.x * v.x + this.y * v.y; }
    dist(v) { return this.sub(v).mag(); }
    copy() { return new Vector(this.x, this.y); }
}
