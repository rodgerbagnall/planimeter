console.log('hi')
var TRACING = false;

var DRAW = SVG('#svg')
DRAW.on(['dblclick', 'dbltap'], event => {event.preventDefault(); TRACING = false;});


rect(50, 50, 500, 510)


function format(n) {
    return n.toLocaleString(undefined, {maximumFractionDigits: 0});
}

function rect(x, y, w, h, fill='goldenrod') {
    let fig = DRAW.nested();
    fig.rect(w, h).fill(fill).remember('params', {x, y, w, h}).click(function() {traceRect(this.remember('params'))});
    let rbox = fig.rbox();
    fig.text(`${format(w * h)} px²`).x(rbox.cx).y(rbox.cy).attr('text-anchor', 'middle');
    fig.move(x, y);
    fig.opacity(0.4);
}

function circle(x, y, r) {
    let fig = DRAW.nested();
    fig.circle(2 * r).fill('goldenrod').remember('params', {x, y, r}).click(function() {traceCircle(this.remember('params'))});
    let rbox = fig.rbox();
    fig.text(`${format(Math.PI * r ** 2)} px²`).x(rbox.cx).y(rbox.cy).attr('text-anchor', 'middle');
    fig.move(x, y);
    fig.opacity(0.4);
}

function polygon(points) {
    let fig = DRAW.nested();
    fig.polygon(points).fill('goldenrod').remember('params', points).click(function() {tracePolygon(this.remember('params'))});

    points.push(points[0]);
    let area = 0, n = points.length - 1;

    for (let i = 0; i < n; i++) {
        area += (points[i][0] - points[i + 1][0]) * (points[i][1] + points[i + 1][1]) / 2;
    }

    let rbox = fig.rbox();

    fig.text(`${format(area)} px²`).x(rbox.cx).y(rbox.cy).attr('text-anchor', 'middle');

    fig.opacity(0.4);
}

class Circle {

    constructor(x, y, r, text, fill, planimeter, zeroiseOnMove=false) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.planimeter = planimeter;

        this.g = DRAW.nested();

        this.g.circle(2 * r).center(r, r).fill(fill).opacity(0.3).attr('tab-index', 0);
        this.g.circle(6).center(r, r).fill('#f00').opacity(0.3);

        this.textElement = this.g.text(text).x(r + 5).y(r - 15);

        this.g.move(x - r, y - r);

        this.g.draggable().on('dragmove', event => {
            this.x = this.g.x() + this.r;
            this.y = this.g.y() + this.r;

            //this.setText(`${this.text} ${this.x} ${this.y}`);
            this.planimeter.drawArms()

            if (zeroiseOnMove) PLANIMETER.zeroise();
        });
    }

    setText(text) {
        this.textElement.clear().text(text);
    }

    move(dx, dy) {
        this.g.move(this.x + dx - this.r, this.y + dy - this.r).fire('dragmove');
    }

    goto(x, y) {
        this.g.move(x - this.r, y - this.r).fire('dragmove');
    }
}

class Planimeter {

    constructor() {
        this.distanceRolled = 0;
        this.angleTurned = 0;

        this.tracer = new Circle(400, 550, 200, 'tracer', '#aad', this);

        this.pole   = new Circle(200, 200, 220, 'pole', '#ada', this, true);

        this.C = Math.PI * (this.pole.r ** 2 + this.tracer.r ** 2);
        this.pole.setText(`pole\nC: ${format(this.C)} px²`);

        this.linkage = DRAW.group().hide();
        this.hinge     = this.linkage.circle(6).fill('grey').opacity(0.3);
        this.tracerArm = this.linkage.line().stroke({color: 'grey', width: 1});
        this.poleArm   = this.linkage.line().stroke({color: 'black', width: 1});

        this.tracer.g.fire('dragmove');
    }

    zeroise() {
        this.distanceRolled = 0;
        this.angleTurned = 0;
        this.tracer.setText(`traced area: ${format(this.distanceRolled)}`);
        TRACING = false;
    }

    drawArms() { // Draw arms meeting at one of the intersection points, if any, of tracer and pole.
        // https://www.petercollingridge.co.uk/tutorials/computational-geometry/circle-circle-drawArms/
        // http://www.ambrsoft.com/TrigoCalc/Circles2/circle2intersection/CircleCircleIntersection.htm

        const d = Math.hypot(this.pole.x - this.tracer.x, this.pole.y - this.tracer.y); // distance between centers

        // too far apart or completely nested?
        if (d > this.pole.r + this.tracer.r || d < Math.abs(this.pole.r - this.tracer.r)) {
            TRACING = false;
            this.linkage.hide();
            this.tracer.setText(`Linkage broken!`)
            return;
        }

        let dx = (this.tracer.x - this.pole.x) / d; // unit vectors for one center to the other
        let dy = (this.tracer.y - this.pole.y) / d;

        // calculate where line through intersection points crosses line through centers
        const a = (this.pole.r ** 2 - this.tracer.r ** 2 + d ** 2) / (2 * d);
        let px = this.pole.x + a * dx;
        let py = this.pole.y + a * dy;

        const h = Math.sqrt(this.pole.r ** 2 - a ** 2); // height of intersection line

        // Calculate the intersection points by moving h px up and down from p,
        // perpendicular to the line between the circle centers.
        let p1 = {x: px + h * dy, y: py - h * dx};
        let p2 = {x: px - h * dy, y: py + h * dx};

        let tracerLine = this.tracerArm.remember('line');

        // arbitrary choice of intersection point
        this.hinge.center(p2.x, p2.y);
        this.tracerArm.plot([p2.x, p2.y, this.tracer.x, this.tracer.y]).remember('line', {x1: p2.x, y1: p2.y, x2: this.tracer.x, y2: this.tracer.y});
        this.poleArm.plot([this.pole.x, this.pole.y, p2.x, p2.y]);
        this.linkage.show();


        if (! tracerLine) return;


        // https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
        let num = (tracerLine.x2 - tracerLine.x1) * (tracerLine.y1 - p2.y) - (tracerLine.x1 - p2.x) * (tracerLine.y2 - tracerLine.y1);
        let dist = num / Math.hypot(tracerLine.x2 - tracerLine.x1, tracerLine.y2 - tracerLine.y1);

        this.distanceRolled -= dist * this.tracer.r;

        this.tracer.setText(`traced: ${format(this.distanceRolled)} px²`);



        // https://stackoverflow.com/questions/14066933/direct-way-of-computing-clockwise-angle-between-2-vectors
        let x1 = tracerLine.x2 - this.pole.x, y1 = tracerLine.y2 - this.pole.y;
        let x2 = this.tracer.x - this.pole.x, y2 = this.tracer.y - this.pole.y;

        this.angleTurned += Math.atan2(x1 * y2 - y1 * x2, x1 * x2 + y1 * y2);
    }

}

    // function distancePointToLine(line, p0) { // signed
    //     // https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
    //     let num = (line.x2 - line.x1) * (line.y1 - p0.y) - (line.x1 - p0.x) * (line.y2 - line.y1);
    //     return num / Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
    // }

let PLANIMETER = new Planimeter();

document.addEventListener('keydown', keyHandler);

function keyHandler(event) {
    if (['z', 'Z', '0'].includes(event.key)) {
        PLANIMETER.zeroise();
        return;
    }

    let dy = dx = 0;

    if      (event.key == 'ArrowUp')    dy = -1;
    else if (event.key == 'ArrowDown')  dy = +1;
    else if (event.key == 'ArrowLeft')  dx = -1;
    else if (event.key == 'ArrowRight') dx = +1;
    else return;

    event.preventDefault();

    if (event.shiftKey) {
        dy *= 10;
        dx *= 10;
    }

    PLANIMETER.tracer.move(dx, dy);
}


class Line {
    constructor(p1, p2) {
        this.p1 = p1;
        this.p2 = p2;

        this.m = (p2.y - p1.y) / (p2.x - p1.x);

        if (p2.x != p1.x) this.c = p1.y - p1.x * this.m;
    }

    y(x) {
        return this.m * x + this.c;
    }

    x(y) {
        return (y - this.c) / this.m;
    }

    * points(delta) {
        if (! TRACING) return;

        let gradient = Math.abs(this.m);

        if (gradient == Infinity) { // vertical
            if (this.p2.y  > this.p1.y) {
                for (let y = this.p1.y; TRACING && y <= this.p2.y; y += delta) {
                    yield {x: this.p1.x, y};
                }
            } else {
                for (let y = this.p1.y; TRACING && y >= this.p2.y; y -= delta) {
                    yield {x: this.p1.x, y};
                }
            }
        } else if (gradient > 1) { // steep
            if (this.p2.y  > this.p1.y) {
                for (let y = this.p1.y; TRACING && y <= this.p2.y; y += delta) {
                    yield {x: this.x(y), y};
                }
            } else {
                for (let y = this.p1.y; TRACING && y >= this.p2.y; y -= delta) {
                    yield {x: this.x(y), y};
                }
            }
        } else { // shallow
            if (this.p2.x > this.p1.x) {
                for (let x = this.p1.x; TRACING && x <= this.p2.x; x += delta) {
                    yield {x, y: this.y(x)};
                }
            } else {
                for (let x = this.p1.x; TRACING && x >= this.p2.x; x -= delta) {
                    yield {x, y: this.y(x)};
                }
            }
        }
    }

}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function setTotalText(delta) {
    // if the tracer has rolled around the pole once, add the zero-circle area
    let r = Math.round((1 / delta) * PLANIMETER.angleTurned / Math.PI);
    if (r != 2 / delta) return;
    let t = PLANIMETER.tracer.textElement.text();
    PLANIMETER.tracer.setText(`${t}, +C = ${format(PLANIMETER.distanceRolled + PLANIMETER.C)}`)
}

async function traceRect(p) {
    PLANIMETER.tracer.goto(p.x, p.y);
    PLANIMETER.zeroise();

    let delta = 0.01, step = 0, major = 40, ms = 1;

    let lines = [
        new Line({x: p.x, y: p.y}, {x: p.x + p.w, y: p.y}),
        new Line({x: p.x + p.w, y: p.y}, {x: p.x + p.w, y: p.y + p.h}),
        new Line({x: p.x + p.w, y: p.y + p.h}, {x: p.x, y: p.y + p.h}),
        new Line({x: p.x, y: p.y + p.h}, {x: p.x, y: p.y})
    ];

    TRACING = true;

    for (line of lines) {
        for (let point of line.points(delta)) {
            PLANIMETER.tracer.goto(point.x, point.y);
            if (step++ % major == 0) await(sleep(ms));
        }
    }

    TRACING = false;

    setTotalText(delta);
}

async function traceCircle(p) {
    let x = p.x + p.r, y = p.y + p.r;
    PLANIMETER.tracer.goto(x + p.r, y);
    PLANIMETER.zeroise();

    let delta = 0.01 / p.r, step = 0, major = 40, ms = 1;

    TRACING = true;

    for (let theta = 0; TRACING && theta <= 2 * Math.PI; theta += delta) {
        PLANIMETER.tracer.goto(x + p.r * Math.cos(theta), y + p.r * Math.sin(theta));
        if (step++ % major == 0) await(sleep(ms));
    }

    TRACING = false;

    setTotalText(delta);
}


async function tracePolygon(points) {
    PLANIMETER.tracer.goto(points[0][0], points[0][1]);
    PLANIMETER.zeroise();

    let n = points.length - 1;

    let delta = 0.01, step = 0, major = 40, ms = 1;

    TRACING = true;

    for (let i = 0; i < n; i++) {
        let line = new Line({x: points[i][0], y: points[i][1]}, {x: points[i + 1][0], y: points[i + 1][1]});

        for (let point of line.points(delta)) {
            PLANIMETER.tracer.goto(point.x, point.y);
            if (step++ % major == 0) await(sleep(ms));
        }
    }

    TRACING = false;

    setTotalText(delta);
}


rect(450, 200, 100, 200)

rect(200, 450, 200, 100)

rect(100, 100, 10, 10)

circle(600, 110, 100)

polygon([[500,410], [650,410], [650,550], [640,550], [640,480], [500,480]])

polygon([[200,300], [170,350], [200,370], [100,360], [50,350], [0,300], [100,150], [150,200]]);