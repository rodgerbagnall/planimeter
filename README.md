# planimeter

Javascript and SVG planimeter emulation.

Currently, you can only set the tracer arm length by editing the code.

Some figures are drawn so that you can trace them, either manually or automatically.

Position the pole (drag it with the mouse) so that the tracer can reach all the points on the boundary of the figure you want to trace.

Trace the figure roughly to check that the pole is positioned correctly.
Re-position the pole if the two arms (joining the pole to the tracer via one of the circle intersection points) disappear at any time.

If you use the 'Interior Pole method' (e.g. to trace the large rectangle) the area reported is followed by the area plus the constant C.
The value of the constant is determined by the lengths of the pole and tracer arms and is shown at the pole.

## Manual tracing

Carefully position the tracer on the edge of the figure and zero the area by pressing z, Z or 0, or by double tapping.
Then carefully trace the figure clockwise, returning to your start point.

You can drag the tracer with the mouse or you can use the arrow keys to move 1 pixel at a time horizontally or vertically.
Hold the shift key down when you press the arrow keys to move 10 pixels at a time. This is much less accurate.

Because your hand makes small, random movements, because you overshoot at corners and because only relatively large increments
can be detected, manual tracing is not very accurate.

## Automatic tracing

You have to position the pole in a suitable location first. Then click or tap one of the
figures to start tracing it automatically.

Automatic tracing advances the tracer arm in very small increments
and is consequently accurate (typically better than 0.01%) but slow.

Cancel automatic tracing by double clicking or double tapping anywhere.


View the page at: https://www.ecclesman.com/p/planimeter.html

# References
* http://whistleralley.com/planimeter/planimeter.htm
* http://www.math.ucsd.edu/~jeggers/Resources/planimeter_slides.pdf Page 5
