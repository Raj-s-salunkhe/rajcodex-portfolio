import { useEffect, useRef, useState } from 'react'

const vertexShader = `#version 300 es
precision highp float;
in vec2 a_position;
in vec2 a_uv;
uniform vec2 u_pointer;
uniform float u_pull;
out vec2 v_uv;
void main(){
  vec2 p=a_position;
  vec2 d=p-u_pointer;
  float influence=exp(-dot(d,d)*11.0)*u_pull;
  p += normalize(d+vec2(0.0001))*influence*0.038;
  v_uv=a_uv;
  gl_Position=vec4(p,0.0,1.0);
}`

const fragmentShader = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_image;
uniform vec2 u_imageSize;
uniform vec2 u_canvasSize;
out vec4 outColor;
void main(){
  float imageAspect=u_imageSize.x/u_imageSize.y;
  float boxAspect=u_canvasSize.x/u_canvasSize.y;
  vec2 uv=v_uv;
  if(imageAspect>boxAspect){float visible=boxAspect/imageAspect;uv.x=(uv.x-0.5)*visible+0.5;}
  else {float visible=imageAspect/boxAspect;uv.y=(uv.y-0.5)*visible+0.5;}
  outColor=texture(u_image,uv);
}`

function shader(gl: WebGL2RenderingContext, type: number, source: string) {
  const value = gl.createShader(type)
  if (!value) return null
  gl.shaderSource(value, source); gl.compileShader(value)
  if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) { gl.deleteShader(value); return null }
  return value
}

export default function InteractivePortrait() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fallbackRef = useRef<HTMLImageElement>(null)
  const [available, setAvailable] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true })
    if (!gl) return
    const vs = shader(gl, gl.VERTEX_SHADER, vertexShader)
    const fs = shader(gl, gl.FRAGMENT_SHADER, fragmentShader)
    if (!vs || !fs) return
    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program)
    gl.deleteShader(vs); gl.deleteShader(fs)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return }
    gl.useProgram(program)

    const cols = 44, rows = 58, positions: number[] = [], uvs: number[] = [], indices: number[] = []
    for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
      const u = x / cols, v = y / rows
      positions.push(u * 2 - 1, 1 - v * 2); uvs.push(u, 1 - v)
      if (x < cols && y < rows) {
        const i = y * (cols + 1) + x
        indices.push(i, i + cols + 1, i + 1, i + 1, i + cols + 1, i + cols + 2)
      }
    }
    const makeBuffer = (target: number, data: Float32Array | Uint16Array) => {
      const buffer = gl.createBuffer(); if (!buffer) return null
      gl.bindBuffer(target, buffer); gl.bufferData(target, data, gl.STATIC_DRAW); return buffer
    }
    const posBuffer = makeBuffer(gl.ARRAY_BUFFER, new Float32Array(positions))
    const uvBuffer = makeBuffer(gl.ARRAY_BUFFER, new Float32Array(uvs))
    const indexBuffer = makeBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices))
    const positionLoc = gl.getAttribLocation(program, 'a_position')
    const uvLoc = gl.getAttribLocation(program, 'a_uv')
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer); gl.enableVertexAttribArray(positionLoc); gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer); gl.enableVertexAttribArray(uvLoc); gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    const texture = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const image = new Image(); image.src = '/images/raj-portrait.jpeg'
    let raf = 0, visible = true, pageVisible = !document.hidden, pulling = 0, targetPull = 0
    let pointer = [0, 0], targetPointer = [0, 0]
    const pointerLoc = gl.getUniformLocation(program, 'u_pointer')
    const pullLoc = gl.getUniformLocation(program, 'u_pull')
    const sizeLoc = gl.getUniformLocation(program, 'u_canvasSize')
    const imageSizeLoc = gl.getUniformLocation(program, 'u_imageSize')
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)
      setAvailable(true); draw()
    }
    image.onerror = () => setAvailable(false)
    const resize = () => {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas); resize()
    const draw = () => {
      raf = 0
      if (!visible || !pageVisible) return
      pulling += (targetPull - pulling) * 0.075
      pointer[0] += (targetPointer[0] - pointer[0]) * 0.12; pointer[1] += (targetPointer[1] - pointer[1]) * 0.12
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(pointerLoc, pointer[0], pointer[1]); gl.uniform1f(pullLoc, pulling)
      gl.uniform2f(sizeLoc, canvas.width, canvas.height); gl.uniform2f(imageSizeLoc, image.width, image.height)
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0)
      if (pulling > 0.002 || targetPull > 0) raf = requestAnimationFrame(draw)
    }
    const startLoop = () => { if (!raf && visible && pageVisible) raf = requestAnimationFrame(draw) }
    const locate = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      targetPointer = [((event.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((event.clientY - rect.top) / rect.height) * 2]
    }
    const down = (event: PointerEvent) => { locate(event); canvas.setPointerCapture(event.pointerId); targetPull = 1; setDragging(true); startLoop() }
    const move = (event: PointerEvent) => { if (event.buttons || event.pointerType === 'touch') locate(event); startLoop() }
    const up = () => { targetPull = 0; setDragging(false); startLoop() }
    const lost = (event: Event) => { event.preventDefault(); setAvailable(false) }
    // A lost context may invalidate every GPU resource; retain the static image.
    const restored = () => { setAvailable(false) }
    const visibility = () => { pageVisible = !document.hidden; if (pageVisible) startLoop(); else if (raf) cancelAnimationFrame(raf) }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) startLoop(); else if (raf) cancelAnimationFrame(raf) })
    observer.observe(canvas)
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored); document.addEventListener('visibilitychange', visibility)
    fallbackRef.current?.addEventListener('load', startLoop, { once: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      resizeObserver.disconnect(); observer.disconnect()
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored); document.removeEventListener('visibilitychange', visibility)
      gl.deleteBuffer(posBuffer); gl.deleteBuffer(uvBuffer); gl.deleteBuffer(indexBuffer); gl.deleteTexture(texture); gl.deleteProgram(program)
    }
  }, [])

  return <div className={`portrait-frame ${available ? 'webgl-ready' : ''} ${dragging ? 'is-dragging' : ''}`}>
    <div className="portrait-orbit" aria-hidden="true" />
    <img ref={fallbackRef} className="portrait-fallback" src="/images/raj-portrait.jpeg" alt="Raj, full-stack developer" fetchPriority="high" />
    <canvas ref={canvasRef} className="portrait-canvas" aria-label="Interactive portrait of Raj. Drag gently to pull the portrait; it springs back." />
    <span className="portrait-sticker" aria-hidden="true">made of<br />curiosity <b>✳</b></span>
    <span className="portrait-caption"><span className="live-dot" /> {dragging ? 'okay, easy!' : 'TRY PULLING MY FACE'}</span>
  </div>
}
