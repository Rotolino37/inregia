"""Genera i file di prova per i test end-to-end di InRegia.
Richiede: python-pptx, ffmpeg nel PATH.
Uscita: tests/fixtures/ (test.pptx, clip.mp4, brano_a.mp3, brano_b.mp3)
"""
import os, subprocess, sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from lxml import etree

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'tests', 'fixtures')
os.makedirs(OUT, exist_ok=True)
P = 'http://schemas.openxmlformats.org/presentationml/2006/main'

def ff(*args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)

clip = os.path.join(OUT, 'clip.mp4')
ff('-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=25:duration=8', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=8',
   '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-b:v', '300k', '-c:a', 'aac', '-b:a', '64k', '-shortest', clip)
poster = os.path.join(OUT, 'poster.png')
ff('-i', clip, '-frames:v', '1', poster)
for name, f1, f2 in (('brano_a', 330, 495), ('brano_b', 262, 392)):
    ff('-f', 'lavfi', '-i', f'sine=frequency={f1}:duration=20', '-f', 'lavfi', '-i', f'sine=frequency={f2}:duration=20',
       '-filter_complex', '[0][1]amerge=inputs=2,volume=0.6', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '96k', os.path.join(OUT, name + '.mp3'))

prs = Presentation(); prs.slide_width = Inches(13.333); prs.slide_height = Inches(7.5)
blank = prs.slide_layouts[6]

def box(sl, txt, x, y, w, h, color):
    s = sl.shapes.add_shape(1, Inches(x), Inches(y), Inches(w), Inches(h))
    s.fill.solid(); s.fill.fore_color.rgb = RGBColor.from_string(color); s.line.fill.background()
    tf = s.text_frame; tf.text = txt; r = tf.paragraphs[0].runs[0]; r.font.size = Pt(28); r.font.bold = True
    return s

def trans(sl, xml):
    e = etree.fromstring(f'<p:transition xmlns:p="{P}" spd="med">{xml}</p:transition>')
    root = sl._element; cs = root.find(f'{{{P}}}clrMapOvr')
    (cs.addnext(e) if cs is not None else root.append(e))

def eff(cid, spid, pid, cls, sub, node, dur):
    vis = 'visible' if cls == 'entr' else 'hidden'
    return (f'<p:par><p:cTn id="{cid}" presetID="{pid}" presetClass="{cls}" presetSubtype="{sub}" fill="hold" nodeType="{node}"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>'
            f'<p:set><p:cBhvr><p:cTn id="{cid+1}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="{vis}"/></p:to></p:set>'
            f'<p:animEffect transition="{"in" if cls == "entr" else "out"}" filter="fade"><p:cBhvr><p:cTn id="{cid+2}" dur="{dur}"/><p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par>')

def timing(groups):
    cid = 10; out = []
    for g in groups:
        inner = ''.join(eff(cid + 5 * k, *e) for k, e in enumerate(g)); cid += 5 * len(g)
        out.append(f'<p:par><p:cTn id="{cid}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="{cid+1}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>{inner}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>'); cid += 2
    return etree.fromstring(f'<p:timing xmlns:p="{P}"><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>{"".join(out)}</p:childTnLst></p:cTn></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>')

# 1 titolo
s1 = prs.slides.add_slide(blank); box(s1, 'InRegia - test', 0.8, 2.6, 11.7, 2, '1F3A93')
s1.notes_slide.notes_text_frame.text = 'Nota della prima slide.'
# 2 animazioni
s2 = prs.slides.add_slide(blank); trans(s2, '<p:fade/>')
box(s2, 'Titolo fisso', 0.5, 0.4, 12.3, 1.2, '2C3E50')
a = box(s2, 'A entra da sinistra', 0.8, 2.2, 5.5, 1.4, 'C0392B')
b = box(s2, 'B dissolvenza', 7, 2.2, 5.5, 1.4, '27AE60')
s2._element.append(timing([[(a.shape_id, 2, 'entr', 8, 'clickEffect', 500)], [(b.shape_id, 10, 'entr', 0, 'clickEffect', 500)]]))
# 3 video
s3 = prs.slides.add_slide(blank); trans(s3, '<p:push dir="u"/>')
s3.shapes.add_movie(clip, Inches(2.7), Inches(1.3), Inches(8), Inches(4.5), poster_frame_image=poster, mime_type='video/mp4')
# 4 e 5 morph: stessa immagine in posizione diversa
s4 = prs.slides.add_slide(blank); trans(s4, '<p:wipe dir="r"/>')
s4.shapes.add_picture(poster, Inches(0.8), Inches(0.8), Inches(4), Inches(2.25)); box(s4, 'Prima del morph', 6, 5, 6, 1.2, '8E44AD')
s5 = prs.slides.add_slide(blank)
s5.shapes.add_picture(poster, Inches(6.5), Inches(3), Inches(6), Inches(3.375)); box(s5, 'Dopo il morph', 0.8, 0.8, 6, 1.2, '8E44AD')
ac = etree.fromstring(f'<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:p="{P}" xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main"><mc:Choice Requires="p159"><p:transition spd="slow"><p159:morph option="byObject"/></p:transition></mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>')
cs = s5._element.find(f'{{{P}}}clrMapOvr'); (cs.addnext(ac) if cs is not None else s5._element.append(ac))
# 6 nascosta, 7 finale
s6 = prs.slides.add_slide(blank); box(s6, 'Slide nascosta', 1, 2.5, 11.3, 2, '7F8C8D'); s6._element.set('show', '0')
s7 = prs.slides.add_slide(blank); trans(s7, '<p:zoom/>'); box(s7, 'Fine', 1, 2.5, 11.3, 2, 'B03A2E')
prs.save(os.path.join(OUT, 'test.pptx'))
os.remove(poster)
print('ok', sorted(os.listdir(OUT)))
