var TRACING = false, DELTA = 0.03, STEP = 0, STEP_PAUSE_AT = 60, SCALE = 1, UNITS = 'px';

var DRAW = SVG('#svg');
DRAW.on(['dblclick', 'dbltap'], event => {event.preventDefault(); TRACING = false;});

function format(n, digits=0) {
    return n.toLocaleString(undefined, {maximumFractionDigits: digits});
}

function setFigureAreaText(fig, digits=3) {
    let params = fig.remember('params');

    if (! params.areaPx) return;

    params.textElement.clear().attr('text-anchor', 'middle')
        .text(`${params.approx ? '≈ ' : ''}${format(params.areaPx, digits)} px²`);
}

function getFig() {
    return DRAW.nested().opacity(0.4).hide().addClass('figure');
}

function rect(x, y, w, h) {
    let fig = getFig();
    let node = fig.rect(w, h).fill('goldenrod');
    let areaPx = w * h;
    let textElement = fig.text().x(w / 2).y(h / 2);
    fig.move(x, y);
    fig.remember('params', {ccw: false, node, textElement, areaPx, approx: false});
    setFigureAreaText(fig);
}

function circle(x, y, r) {
    let fig = getFig();
    let node = fig.circle(2 * r).fill('goldenrod');
    let areaPx = Math.PI * r ** 2;
    let textElement = fig.text().x(r).y(r);
    fig.move(x, y);
    fig.remember('params', {ccw: false, node, textElement, areaPx, approx: false});
    setFigureAreaText(fig);
}

function areaCentroidPoly(p) {
    let area = 0, x = 0, y = 0;

    for (let i = 0, len = p.length; i < len; i++) {
        let j = (i + 1) % len;

        // https://github.com/mapbox/polylabel/blob/master/polylabel.js
        let t2 = (p[i][0] * p[j][1] - p[j][0] * p[i][1]);

        x += (p[i][0] + p[j][0]) * t2;
        y += (p[i][1] + p[j][1]) * t2;

        area += t2;
    }

    return {area: area / 2, x: x / (3 * area), y: y / (3 * area)};
}

function polygon(params, points) {
    params = Object.assign({ccw: false, x: 0, y: 0, approx: false, areaPx: NaN}, params);
    let fig = getFig();
    fig.move(params.x, params.y);
    fig.remember('params', params);
    params['node'] = fig.polygon(points).fill('goldenrod');

    let ac = areaCentroidPoly(points);
    params['textElement'] = fig.text().x(ac.x).y(ac.y);

    params.areaPx = params.ccw ? 0 - ac.area : ac.area;

    setFigureAreaText(fig, 1);
}

async function path(params, pathString) {
    params = Object.assign({ccw: false, x: 0, y: 0, approx: true, areaPx: NaN}, params);
    let fig = getFig();
    fig.move(params.x, params.y);
    fig.remember('params', params);
    let node = fig.path(pathString).fill('goldenrod');
    params['node'] = node;

    let box = fig.show().bbox();
    fig.hide();
    params['textElement'] = fig.text(`calculating`).x(box.cx).y(box.cy);

    let pathLength = node.node.getTotalLength(), p0 = node.node.getPointAtLength(0), areaPx = 0;

    for (let length = 10 * DELTA; length <= pathLength; length += 10 * DELTA) {
        let p = node.node.getPointAtLength(length);
        areaPx += (p0.x - p.x) * (p0.y + p.y) / 2;
        p0 = p;
        if (STEP++ % STEP_PAUSE_AT === 0) await sleep(0);
    }

    params.areaPx = params.ccw ? 0 - areaPx : areaPx;

    setFigureAreaText(fig, 1);
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
    constructor(armLengthsPx) {
        //armLengthsPx = Object.assign({pole: 220, tracer: 200}, armLengthsPx);

        this.areaTracedPx = 0;
        this.angleTurnedRadians = 0;

        this.tracer = new Circle(400, 550, armLengthsPx.tracer, 'tracer', '#aad', this);

        this.pole   = new Circle(200 - armLengthsPx.pole, 200, armLengthsPx.pole, 'pole', '#ada', this, true);

        this.C = Math.PI * (this.pole.r ** 2 + this.tracer.r ** 2);
        this.pole.setText(`pole\nzero circle: ${format(this.C)} px²`);

        this.linkage = DRAW.group().hide();
        this.hinge     = this.linkage.circle(6).fill('grey').opacity(0.3);
        this.tracerArm = this.linkage.line().stroke({color: 'grey', width: 1});
        this.poleArm   = this.linkage.line().stroke({color: 'black', width: 1});

        this.tracer.g.fire('dragmove');

        this.front = this.tracer;
    }

    clear() {
        this.tracer.g.remove();
        this.pole.g.remove();
        this.linkage.remove();
    }

    zeroise() {
        this.areaTracedPx = 0;
        this.angleTurnedRadians = 0;
        this.setTracedAreaText();
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

        this.areaTracedPx -= dist * this.tracer.r;



        // https://stackoverflow.com/questions/14066933/direct-way-of-computing-clockwise-angle-between-2-vectors
        let x1 = memory.x2 - this.pole.x, y1 = memory.y2 - this.pole.y;
        let x2 = this.tracer.x - this.pole.x, y2 = this.tracer.y - this.pole.y;

        this.angleTurnedRadians += Math.atan2(x1 * y2 - y1 * x2, x1 * x2 + y1 * y2);

        this.setTracedAreaText();
    }

    setTracedAreaText() {
        let area = this.areaTracedPx / SCALE;

        // if the tracer has rolled around the pole once then add the zero-circle area
        if (this.angleTurnedRadians > 2 * Math.PI * 0.999) area += this.C / SCALE;

        this.tracer.setText(`traced: ${format(area, 3)} ${UNITS}²`);
    }
}

var PLANIMETER = null;
changeArmLength();

document.addEventListener('keydown', keyHandler);

function foregroundNextFigure() {
    let figures = DRAW.find('.figure'), len = figures.length;

    if (len === 0) return;

    for (let i = 0; i < len; i++) {
        if (figures[i].hasClass('fg')) {
            figures[i].removeClass('fg');
            figures[(i + 1) % len].addClass('fg').front();
            return;
        }
    }

    figures[0].addClass('fg').front();
}

function keyHandler(event) {
    if (['z', 'Z', '0', 'Escape'].includes(event.key)) {
        PLANIMETER.zeroise();
        return;
    }

    if (event.code === 'KeyP') {
        PLANIMETER.front = PLANIMETER.pole;
        PLANIMETER.front.g.front();
        return;
    }

    if (event.code === 'KeyT') {
        PLANIMETER.front = PLANIMETER.tracer;
        PLANIMETER.front.g.front();
        return;
    }

    if (event.code === 'KeyF') {
        foregroundNextFigure();
        return;
    }

    if (event.code === 'KeyC') {
        PLANIMETER.setScale(event);
        return;
    }

    arrow(event);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function autoTrace(params) {
    if (params.node.parent().opacity() === 0) return;

    let path = params.node.node, pathLength = path.getTotalLength(), p0 = path.getPointAtLength(0);

    let offset = {x: path.viewportElement.x.baseVal.value, y: path.viewportElement.y.baseVal.value};

    PLANIMETER.tracer.goto(offset.x + p0.x, offset.y + p0.y);
    PLANIMETER.zeroise();

    TRACING = true;

    if (params.ccw) {
        for (let length = pathLength; TRACING && length >= 0; length -= DELTA) {
            let p = path.getPointAtLength(length);
            PLANIMETER.tracer.goto(offset.x + p.x, offset.y + p.y);
            if (STEP++ % STEP_PAUSE_AT === 0) await sleep(0);
        }
    } else {
        for (let length = 0; TRACING && length <= pathLength; length += DELTA) {
            let p = path.getPointAtLength(length);
            PLANIMETER.tracer.goto(offset.x + p.x, offset.y + p.y);
            if (STEP++ % STEP_PAUSE_AT === 0) await sleep(0);
        }
    }

    TRACING = false;
}


rect(50, 150, 500, 510)

rect(450, 200, 100, 200)

rect(200, 450, 200, 100)

circle(600, 110, 100)

polygon({x: 500, y: 410}, [[0, 0], [150, 0], [150, 140], [140, 140], [140, 70], [0, 70]])

polygon({x: 0, y: 150}, [[200, 150], [170, 200], [200, 220], [100, 210], [50, 200], [0, 150], [100, 0], [150, 50]]);

path({ccw: true, x: 0, y: 0}, `M 137 222
    C 124 222  120 258  120 265
    C 120 289  115 315  129 325
    C 148 340  167 344  180 347
    C 210 355  228 359  246 360
    C 281 362  302 362  322 361
    C 357 359  374 351  391 347
    C 409 343  427 326  432 313
    C 441 292  458 282  464 266
    Z`);

path({ccw: true, x: 20, y: 400}, `m 65,129
    c 6,-13 2,-21 9,-28
    13,-11 33,-8 50,-5 16,2 25,18 32,32 18,34 -4,83 -43,88 -14,3 -31,2 -43,-7
    C 54,196 48,175 45,155
    40,128 38,98 53,74 77,47 121,42 152,60 c 12,5 26,13 40,9 12,-5 11,-23 2,-31
    C 181,24 159,25 141,24
    117,24 93,19 69,20 50,22 31,31 23,49 10,75 10,106 10,134
    c 1,35 15,69 28,102
    6,14 22,23 38,24 16,1 33,0 50,0 22,-2 43,-18 53,-38 16,-31 19,-66 4,-96
    C 175,100 150,84 128,67
    108,56 83,64 67,79 57,90 53,106 52,121
    c -1,7 6,20 12,9
    Z`);

function toggleMap() {
    let map = document.getElementById('map');
    let visibility = map.style.visibility;

    if (visibility !== 'hidden') {
        map.style.visibility = 'hidden';
        SCALE = 1;
        UNITS = 'px';
        return;
    }

    map.style.visibility = 'visible';
    SCALE = parseFloat(map.dataset.scale);
    UNITS = map.dataset.units;

    for (fig of DRAW.find('.figure')) {
        fig.hide().remember('params').node.off('click');
    }
}

function toggleFigures() {
    let figures = DRAW.find('.figure');
    console.log(figures.some(x => x.visible()))

    if (figures.length === 0) return;

    if (figures.some(f => f.visible())) {
        for (fig of figures) {
            fig.hide().remember('params').node.off('click');
        }
        return;
    }

    let map = document.getElementById('map');
    map.style.visibility = 'hidden';
    SCALE = 1;
    UNITS = 'px';

    for (fig of figures) {
        fig.show();
        let params = fig.remember('params');
        params.node.on('click', function() {autoTrace(params)});
    }
}

function changeArmLength() {
    let tracer = parseFloat(document.getElementById('tracer_arm_length_px').value);
    let pole = parseFloat(document.getElementById('pole_arm_length_px').value);
    if (PLANIMETER !== null) PLANIMETER.clear();
    PLANIMETER = new Planimeter({tracer, pole});
}

function arrow(event) {
    let dy = dx = 0;

    if (! event.key) event.key = `Arrow${event.target.id}`;

    if      (event.key === 'ArrowUp')    dy = -1;
    else if (event.key === 'ArrowDown')  dy = +1;
    else if (event.key === 'ArrowLeft')  dx = -1;
    else if (event.key === 'ArrowRight') dx = +1;

    if (dx === 0 && dy === 0) return;

    event.preventDefault();

    if (event.shiftKey) {
        dy *= 10;
        dx *= 10;
    }

    PLANIMETER.front.move(dx, dy);
}

document.getElementById('toggle_figures').onclick = toggleFigures;

document.getElementById('toggle_map').onclick = toggleMap;

document.getElementById('zeroise').onclick = function() {PLANIMETER.zeroise()};

document.getElementById('tracer_arm_length_px').onchange = changeArmLength;

document.getElementById('pole_arm_length_px').onchange = changeArmLength;

var INTERVAL_ID;

let arrows = document.getElementById('arrows');

arrows.addEventListener('mousedown', mouseDown);
arrows.addEventListener('mouseup',   mouseUp);
arrows.addEventListener('mouseout',  mouseUp);

function mouseDown(event) {
    clearInterval(INTERVAL_ID);
    arrow(event);
    INTERVAL_ID = setInterval(arrow, 50, event);
}

function mouseUp() {
    clearInterval(INTERVAL_ID);
}

