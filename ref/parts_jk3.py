# parts_jk3.py — supplements from the front/back/side component sheet (ref/jk_parts_c.jpg, 4.44 px grid):
# the drawn skin arm (sleeve, bare forearm, hand) from the side view replaces the puppet's procedural far arm.
# The sheet's views are not to one scale (side view ~0.8x, front ~1.2x of the world), so only these small
# parts are taken, at res 1.4 (their rest lengths match the rig's arm). Merges into src/jk-parts.js.
import os, sys, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from parts_jk2 import grab, outline, rel   # reuse the cutters (parts_jk2 re-runs its own cut on import; harmless)
C = Image.open('jkp_c_native4.png').convert('RGBA')
src = open(os.path.join('..', 'src', 'jk-parts.js'), encoding='utf-8').read()
head = 'root.CAST.jkParts = '
data = json.loads(src[src.index(head) + len(head): src.rindex('; })')])
def put(name, im, pivot, tip=None, res=1.4):
    outline(im)
    d = {'w': im.width, 'h': im.height, 'd': base64.b64encode(im.tobytes()).decode('ascii'), 'pivot': list(pivot), 'res': res, 'name': name}
    if tip: d['tip'] = list(tip)
    data[name] = d; im.save('part3_%s.png' % name)
box = (36, 227, 46, 251); put('fArmF', grab(C, box), rel(box, (41, 229)), rel(box, (41, 249)))
box = (35, 246, 47, 257); put('handF', grab(C, box), rel(box, (41, 249)))
js = src[:src.index(head) + len(head)] + json.dumps(data) + src[src.rindex('; })'):]
open(os.path.join('..', 'src', 'jk-parts.js'), 'w', encoding='utf-8').write(js)
print('added', [n for n in ('fArmF', 'handF')], {n: (data[n]['w'], data[n]['h'], data[n]['pivot'], data[n].get('tip')) for n in ('fArmF', 'handF')})
