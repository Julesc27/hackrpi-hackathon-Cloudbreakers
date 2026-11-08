import { circle, ellipse, line, col, TAU } from './iso.js'

// Drawn inside the character's local, facing-direction transform so tools stay
// in their hands at every zoom, on either side of an island or bridge.
export function drawTaskTool(ctx, task, top, hip, sleeve, hand, motion = true) {
  const time = motion ? task.elapsed : .25
  const cycle = (time * 1.7) % 1
  const swing = Math.sin(cycle * TAU)
  const kind = task.kind
  const arm = (x, y) => {
    line(ctx, 1.6, top+1.6, x, y, sleeve, 1.5)
    circle(ctx, x, y, .65, hand)
  }
  if (['chop', 'mine', 'crystal', 'build', 'repair', 'beacon'].includes(kind)) {
    const x = 3.4 + swing*.5, y = top+2.3 - Math.max(0, swing)*2.3
    arm(x, y)
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.65 + swing*.95)
    line(ctx, 0, 2.2, 0, -5.8, col(kind === 'beacon' ? '#d5b36a' : '#8b5b34'), .85)
    line(ctx, -.2, 1.8, -.2, -5.7, col('#d8b879'), .22)
    if (kind === 'chop') {
      ctx.beginPath(); ctx.moveTo(-.4,-5.8); ctx.lineTo(3.8,-7); ctx.quadraticCurveTo(5,-5.4,3.7,-3.5); ctx.lineTo(-.4,-4.5); ctx.closePath()
      ctx.fillStyle=col('#c1d4df'); ctx.fill(); ctx.strokeStyle=col('#526a82'); ctx.lineWidth=.35; ctx.stroke()
      line(ctx, 3.8,-6.8,3.8,-3.7,col('#f4f4e9'),.5)
    } else if (kind === 'mine' || kind === 'crystal') {
      ctx.beginPath(); ctx.moveTo(-4.1,-4); ctx.quadraticCurveTo(0,-8,4.3,-4.8); ctx.lineTo(.1,-6); ctx.closePath()
      ctx.fillStyle=col('#b9cddd'); ctx.fill(); ctx.strokeStyle=col('#526a82'); ctx.lineWidth=.4; ctx.stroke()
    } else if (kind === 'beacon') {
      ctx.beginPath(); ctx.arc(0,-6,1.6,-Math.PI*.15,Math.PI*1.15); ctx.strokeStyle=col('#edc76c'); ctx.lineWidth=1.1; ctx.stroke()
      circle(ctx,0,1.6,.7,col('#edc76c'))
    } else {
      ctx.fillStyle=col('#8eabc0'); ctx.fillRect(-2.3,-6.6,4.6,2.5)
      ctx.strokeStyle=col('#51677e'); ctx.lineWidth=.4; ctx.strokeRect(-2.3,-6.6,4.6,2.5)
      line(ctx,-1.8,-6.2,1.9,-6.2,col('#f5e5b0'),.4)
    }
    ctx.restore()
    if (kind === 'build' || kind === 'repair') {
      line(ctx, 4, -.9, 10, -2.4, col('#bd8a50'), 1.5)
      line(ctx, 5, -2.4, 10, -.6, col('#e0b77a'), 1.2)
    }
    if (motion && cycle > .48 && cycle < .9) {
      const p = (cycle-.48)/.42
      for (let i=0; i<4; i++) {
        circle(ctx, 7+(i-1.5)*p*3, -2-p*(4+i%2*3)+p*p*4, .65*(1-p), col(task.color, Math.round((1-p)*10)/10))
      }
    }
  } else if (kind === 'collect' || kind === 'garden') {
    const y=top+3+Math.sin(time*5)*.4
    arm(3.5,y)
    ctx.fillStyle=col('#759ebb'); ctx.fillRect(3,y,3.5,2.8)
    ellipse(ctx,4.7,y,1.75,.65,col('#accbdc'),col('#e8d8a8'),.3)
    ctx.beginPath(); ctx.arc(2.9,y+1.2,1.2,Math.PI*.5,Math.PI*1.5); ctx.strokeStyle=col('#b4d1df'); ctx.lineWidth=.55; ctx.stroke()
    line(ctx,6,y+1,8,y-.1,col('#a2c8dc'),.75)
    if (motion) for (let i=0; i<5; i++) {
      const p=(time*2+i/5)%1
      circle(ctx,8+p*2+i%2*.4,y+p*5,.35,col('#b4ecff',Math.round((1-p)*10)/10))
    }
    if (kind === 'garden') for (let i=0;i<3;i++) {
      line(ctx,7+i*1.5,-.3,7+i*1.5,-2,col('#6f9b58'),.4)
      ellipse(ctx,6.5+i*1.5,-1.5,.85,.35,col('#b3cf79'))
    }
  } else if (kind === 'harvest') {
    arm(4.3,top+4+swing*1.3)
    ellipse(ctx,5,-1.8,3,1.8,col('#bc8b53'),col('#654c35'),.4)
    for (let i=0;i<3;i++) circle(ctx,4+i,-2.5-(i%2)*.6,.8,col(i%2?'#a9d178':'#d89867'))
    if (motion) ellipse(ctx,6+swing,top+4+swing*1.3,1,.5,col('#b8df87'))
  } else if (kind === 'fish') {
    arm(3.5,top+3)
    const tipX=12+Math.sin(time*3)*.4, tipY=top-6+Math.sin(time*3)*.8
    line(ctx,3,top+4,tipX,tipY,col('#c9a36c'),.65)
    ctx.beginPath(); ctx.moveTo(tipX,tipY); ctx.quadraticCurveTo(16,top,16,-1); ctx.strokeStyle=col('#e6dfbf',.85); ctx.lineWidth=.25; ctx.stroke()
    ellipse(ctx,16,1,4,1.2,col('#8bd5ff',.25),col('#b3e8ff',.65),.3)
    circle(ctx,16,-.4+Math.sin(time*5)*.3,.6,col('#e4aa67'))
  }
}

export function drawTaskProgress(ctx, a) {
  if (!a.task) return
  ctx.beginPath(); ctx.ellipse(a.x,a.y+1,12,6,0,-Math.PI/2,-Math.PI/2+TAU*a.task.progress)
  ctx.strokeStyle=a.task.color; ctx.lineWidth=1.7; ctx.lineCap='round'; ctx.stroke()
}
