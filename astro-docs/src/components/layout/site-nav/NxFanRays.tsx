import { useEffect, useRef } from 'react';

const SPEED = 3;
const START_TIME = 120;
const RESOLUTION = 1.5;

/**
 * Animated blue ray fan at the bottom of the footer. Port of the nx.dev
 * (Framer) "Nx Fan Rays" code component: same shader, uniforms and timing.
 * Shared with the blog (nrwl/nx-blog, blog/src/components/NxFanRays.tsx).
 */
export function NxFanRays({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let cleanup = () => {};

    // The shader source is large, so keep it out of the main bundle.
    import('./nx-fan-rays-shader').then(
      ({ VERTEX_SHADER, FRAGMENT_SHADER, UNIFORMS }) => {
        if (disposed) return;
        const gl = canvas.getContext('webgl2', {
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        });
        if (!gl) return;

        const compile = (type: number, source: string) => {
          const shader = gl.createShader(type)!;
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
          }
          return shader;
        };

        const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
        const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
        const program = gl.createProgram()!;
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          console.error(gl.getProgramInfoLog(program));
          return;
        }
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 3, -1, -1, 3]),
          gl.STATIC_DRAW
        );
        const position = gl.getAttribLocation(program, 'aPos');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

        for (const [name, type, value] of UNIFORMS) {
          const location = gl.getUniformLocation(program, name);
          if (location) (gl as any)['uniform' + type](location, value);
        }

        const timeLocation = gl.getUniformLocation(program, 'uTime');
        const resLocation = gl.getUniformLocation(program, 'uRes');
        const reducedMotion = window.matchMedia(
          '(prefers-reduced-motion: reduce)'
        );

        let elapsed = 0;
        let previous = 0;
        let frame = 0;
        let visible = true;

        const draw = () => {
          gl.uniform1f(timeLocation, START_TIME + elapsed);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        };

        const resize = () => {
          const scale = Math.min(
            (window.devicePixelRatio || 1) * RESOLUTION,
            2
          );
          const width = Math.max(1, Math.round(canvas.clientWidth * scale));
          const height = Math.max(1, Math.round(canvas.clientHeight * scale));
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }
          gl.viewport(0, 0, width, height);
          gl.uniform2f(resLocation, width, height);
          draw();
        };

        const tick = (now: number) => {
          frame = requestAnimationFrame(tick);
          if (previous) {
            elapsed += (Math.min(now - previous, 100) / 1000) * SPEED;
          }
          previous = now;
          draw();
        };

        const sync = () => {
          const shouldPlay =
            !reducedMotion.matches && visible && !document.hidden;
          if (shouldPlay && !frame) {
            previous = 0;
            frame = requestAnimationFrame(tick);
          } else if (!shouldPlay && frame) {
            cancelAnimationFrame(frame);
            frame = 0;
          }
          resize();
        };

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas);
        const intersectionObserver = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          sync();
        });
        intersectionObserver.observe(canvas);
        document.addEventListener('visibilitychange', sync);
        reducedMotion.addEventListener('change', sync);
        sync();

        cleanup = () => {
          cancelAnimationFrame(frame);
          resizeObserver.disconnect();
          intersectionObserver.disconnect();
          document.removeEventListener('visibilitychange', sync);
          reducedMotion.removeEventListener('change', sync);
          gl.deleteBuffer(buffer);
          gl.deleteProgram(program);
          gl.deleteShader(vertex);
          gl.deleteShader(fragment);
          gl.getExtension('WEBGL_lose_context')?.loseContext();
        };
      }
    );

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div className={`relative overflow-hidden bg-[#111A5A] ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block h-full w-full"
      />
    </div>
  );
}
