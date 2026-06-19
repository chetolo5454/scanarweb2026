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
    perp() { return new Vector(-this.y, this.x); } // Perpendicular
}

// Global Physics constants
const FRICTION = 0.985;
const RESTITUTION = 0.8;
const WALL_RESTITUTION = 0.8;
const MIN_VELOCITY = 0.05;

// Math utils
function closestPointOnSegment(p, a, b) {
    const ab = b.sub(a);
    const ap = p.sub(a);
    let t = ap.dot(ab) / ab.dot(ab);
    t = Math.max(0, Math.min(1, t));
    return a.add(ab.mult(t));
}

function lineCircleIntersection(a, b, c, r) {
    const ab = b.sub(a);
    const ac = c.sub(a);
    let t = ac.dot(ab) / ab.dot(ab);
    t = Math.max(0, Math.min(1, t));
    const closest = a.add(ab.mult(t));
    const distSq = closest.sub(c).dot(closest.sub(c));
    if (distSq <= r * r) {
        return closest;
    }
    return null;
}

// Raycast: start point, direction, max distance. Returns closest hit.
// Simple check against segments.
