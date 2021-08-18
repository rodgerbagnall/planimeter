var TRACING = false, DELTA = 0.03, STEP = 0, STEP_PAUSE_AT = 60;

var DRAW = SVG('#svg')
DRAW.on(['dblclick', 'dbltap'], event => {event.preventDefault(); TRACING = false;});

function format(n) {
    return n.toLocaleString(undefined, {maximumFractionDigits: 0});
}

function rect(x, y, w, h) {
    let fig = DRAW.nested();
    fig.rect(w, h).fill('goldenrod').click(function() {autoTrace(this)});
    fig.text(`${format(w * h)} px²`).x(w / 2).y(h / 2).attr('text-anchor', 'middle');
    fig.move(x, y);
    fig.opacity(0.4);
}

function circle(x, y, r) {
    let fig = DRAW.nested();
    fig.circle(2 * r).fill('goldenrod').click(function() {autoTrace(this)});
    fig.text(`${format(Math.PI * r ** 2)} px²`).x(r).y(r).attr('text-anchor', 'middle');
    fig.move(x, y);
    fig.opacity(0.4);
}

function polygon(points, ccw=false) {
    let fig = DRAW.nested();
    fig.polygon(points).fill('goldenrod').click(function() {autoTrace(this, ccw)});
    fig.opacity(0.4);

    points.push(points[0]);
    let area = 0, n = points.length - 1;

    for (let i = 0; i < n; i++) {
        area += (points[i][0] - points[i + 1][0]) * (points[i][1] + points[i + 1][1]) / 2;
    }

    let box = fig.bbox();
    fig.text(`${format(ccw ? 0 - area : area)} px²`).x(box.cx).y(box.cy).attr('text-anchor', 'middle');
}

async function path(pathString, ccw=false) {
    let fig = DRAW.nested();
    let node = fig.path(pathString).fill('goldenrod').click(function() {autoTrace(this, ccw)}).node;
    fig.opacity(0.4);

    let pathLength = node.getTotalLength(), p0 = node.getPointAtLength(0), area = 0;

    for (let length = DELTA; length <= pathLength; length += DELTA) {
        let p = node.getPointAtLength(length);
        area += (p0.x - p.x) * (p0.y + p.y) / 2;
        p0 = p;
        if (STEP++ % STEP_PAUSE_AT == 0) await(sleep(0));
    }

    let box = fig.bbox();
    fig.text(`${format(ccw ? 0 - area : area)} px²`).x(box.cx).y(box.cy).attr('text-anchor', 'middle');
}

class Circle {

    constructor(x, y, r, text, fill, planimeter, zeroiseOnMove=false) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.planimeter = planimeter;
        this.zeroiseOnMove = zeroiseOnMove;

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

            if (this.zeroiseOnMove) PLANIMETER.zeroise();
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

        let memory = this.tracerArm.remember('line');

        // arbitrary choice of intersection point
        this.hinge.center(p2.x, p2.y);
        this.tracerArm.plot([p2.x, p2.y, this.tracer.x, this.tracer.y]).remember('line', {x1: p2.x, y1: p2.y, x2: this.tracer.x, y2: this.tracer.y});
        this.poleArm.plot([this.pole.x, this.pole.y, p2.x, p2.y]);
        this.linkage.show();


        if (! memory) return;


        // https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
        let num = (memory.x2 - memory.x1) * (memory.y1 - p2.y) - (memory.x1 - p2.x) * (memory.y2 - memory.y1);
        let dist = num / Math.hypot(memory.x2 - memory.x1, memory.y2 - memory.y1);

        this.distanceRolled -= dist * this.tracer.r;

        this.tracer.setText(`traced: ${format(this.distanceRolled)} px²`);



        // https://stackoverflow.com/questions/14066933/direct-way-of-computing-clockwise-angle-between-2-vectors
        let x1 = memory.x2 - this.pole.x, y1 = memory.y2 - this.pole.y;
        let x2 = this.tracer.x - this.pole.x, y2 = this.tracer.y - this.pole.y;

        this.angleTurned += Math.atan2(x1 * y2 - y1 * x2, x1 * x2 + y1 * y2);
    }

}

let PLANIMETER = new Planimeter();

document.addEventListener('keydown', keyHandler);

function keyHandler(event) {
    if (['z', 'Z', '0', 'Escape'].includes(event.key)) {
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function autoTrace(fig, ccw) {
    let path = fig.node, pathLength = path.getTotalLength(), p0 = path.getPointAtLength(0);

    let offset = {x: path.viewportElement.x.baseVal.value, y: path.viewportElement.y.baseVal.value};

    PLANIMETER.tracer.goto(offset.x + p0.x, offset.y + p0.y);
    PLANIMETER.zeroise();

    TRACING = true;

    if (ccw) {
        for (let length = pathLength; TRACING && length >= 0; length -= DELTA) {
            let p = path.getPointAtLength(length);
            PLANIMETER.tracer.goto(offset.x + p.x, offset.y + p.y);
            if (STEP++ % STEP_PAUSE_AT == 0) await(sleep(0));
        }
    } else {
        for (let length = 0; TRACING && length <= pathLength; length += DELTA) {
            let p = path.getPointAtLength(length);
            PLANIMETER.tracer.goto(offset.x + p.x, offset.y + p.y);
            if (STEP++ % STEP_PAUSE_AT == 0) await(sleep(0));
        }
    }

    TRACING = false;

    if (PLANIMETER.angleTurned >= 2 * Math.PI * 0.999) { // really, depends on DELTA
        // the tracer has rolled around the pole once so add the zero-circle area
        let t = PLANIMETER.tracer.textElement.text();
        PLANIMETER.tracer.setText(`${t}, +C = ${format(PLANIMETER.distanceRolled + PLANIMETER.C)}`)
    }
}


rect(50, 50, 500, 510)

rect(450, 200, 100, 200)

rect(200, 450, 200, 100)

rect(100, 100, 10, 10)

circle(600, 110, 100)

polygon([[500,410], [650,410], [650,550], [640,550], [640,480], [500,480]])

polygon([[200,300], [170,350], [200,370], [100,360], [50,350], [0,300], [100,150], [150,200]]);

path(`M 137.077 222.345
    C 124.162 222.345  120.887 258.264  120.887 265.519
    C 120.887 289.603  115.130 315.169  129.522 325.962
    C 148.995 340.568  167.219 344.292  180.251 347.549
    C 210.399 355.086  228.430 359.240  246.091 360.502
    C 281.021 362.997  302.891 362.903  322.724 361.581
    C 357.330 359.274  374.138 351.966  391.803 347.549
    C 409.773 343.057  427.540 326.205  432.818 313.010
    C 441.201 292.051  458.843 282.426  464.119 266.598
    Z`, true);