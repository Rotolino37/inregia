"""Deck di prova della compatibilità animazioni/transizioni di InRegia: tests/fixtures/effects.pptx.
Ogni effetto è scritto come lo salva PowerPoint (presetID, comportamenti, formule #ppt_*).
Richiede python-pptx e lxml.
"""
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from lxml import etree

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'tests', 'fixtures', 'effects.pptx')
P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main'
P15 = 'http://schemas.microsoft.com/office/powerpoint/2012/main'
MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006'

prs = Presentation(); prs.slide_width = Inches(13.333); prs.slide_height = Inches(7.5)
blank, bullets = prs.slide_layouts[6], prs.slide_layouts[1]
CID = [100]


def nid():
    CID[0] += 1; return CID[0]


def box(sl, txt, x, y, w, h, color):
    s = sl.shapes.add_shape(1, Inches(x), Inches(y), Inches(w), Inches(h))
    s.fill.solid(); s.fill.fore_color.rgb = RGBColor.from_string(color); s.line.fill.background()
    tf = s.text_frame; tf.text = txt; r = tf.paragraphs[0].runs[0]; r.font.size = Pt(24); r.font.bold = True
    return s


def trans(sl, xml, p14=False):
    if p14:
        e = etree.fromstring(f'<mc:AlternateContent xmlns:mc="{MC}" xmlns:p14="{P14}" xmlns:p15="{P15}"><mc:Choice Requires="p15"><p:transition xmlns:p="{P}" spd="slow" p14:dur="1250">{xml}</p:transition></mc:Choice>'
                             f'<mc:Fallback><p:transition xmlns:p="{P}" spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>')
    else:
        e = etree.fromstring(f'<p:transition xmlns:p="{P}" xmlns:p14="{P14}" spd="slow" p14:dur="1000">{xml}</p:transition>')
    root = sl._element; cs = root.find(f'{{{P}}}clrMapOvr')
    (cs.addnext(e) if cs is not None else root.append(e))


def tgt(spid, para=None):
    return f'<p:spTgt spid="{spid}">' + (f'<p:txEl><p:pRg st="{para}" end="{para}"/></p:txEl>' if para is not None else '') + '</p:spTgt>'


def ctn(dur, delay=0, extra=''):
    return f'<p:cTn id="{nid()}" dur="{dur}" fill="hold"{extra}><p:stCondLst><p:cond delay="{delay}"/></p:stCondLst></p:cTn>'


def vis(spid, para, val):
    return f'<p:set><p:cBhvr>{ctn(1)}<p:tgtEl>{tgt(spid, para)}</p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="{val}"/></p:to></p:set>'


def anim(spid, para, attr, vals, dur=500, extra=''):
    tav = ''.join(f'<p:tav tm="{t}"><p:val><p:strVal val="{v}"/></p:val></p:tav>' for t, v in vals)
    return f'<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base">{ctn(dur, 0, extra)}<p:tgtEl>{tgt(spid, para)}</p:tgtEl><p:attrNameLst><p:attrName>{attr}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst>{tav}</p:tavLst></p:anim>'


def fx(spid, para, filt, io='in', dur=500, pr=''):
    return f'<p:animEffect transition="{io}" filter="{filt}"{f" prLst=\"{pr}\"" if pr else ""}><p:cBhvr>{ctn(dur)}<p:tgtEl>{tgt(spid, para)}</p:tgtEl></p:cBhvr></p:animEffect>'


def effect(pid, cls, sub, node, body, grp=0):
    return (f'<p:par><p:cTn id="{nid()}" presetID="{pid}" presetClass="{cls}" presetSubtype="{sub}" fill="hold" grpId="{grp}" nodeType="{node}"><p:stCondLst><p:cond delay="0"/></p:stCondLst>'
            f'<p:childTnLst>{body}</p:childTnLst></p:cTn></p:par>')


def click(*effects):
    inner = ''.join(effects)
    return (f'<p:par><p:cTn id="{nid()}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>'
            f'<p:par><p:cTn id="{nid()}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>{inner}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>')


def timing(sl, clicks, bld=''):
    x = (f'<p:timing xmlns:p="{P}"><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek">'
         f'<p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>{"".join(clicks)}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
         f'<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>{bld}</p:timing>')
    sl._element.append(etree.fromstring(x))


# effetti di ingresso nel modo in cui li salva PowerPoint
def e_fade(s, p=None, node='clickEffect'): return effect(10, 'entr', 0, node, vis(s, p, 'visible') + fx(s, p, 'fade'))
def e_fly_left(s, p=None, node='clickEffect'): return effect(2, 'entr', 8, node, vis(s, p, 'visible') + anim(s, p, 'ppt_x', [(0, '0-#ppt_w/2'), (100000, '#ppt_x')]) + anim(s, p, 'ppt_y', [(0, '#ppt_y'), (100000, '#ppt_y')]))
def e_float_in(s, p=None, node='clickEffect'): return effect(42, 'entr', 0, node, vis(s, p, 'visible') + fx(s, p, 'fade', dur=1000) + anim(s, p, 'ppt_x', [(0, '#ppt_x'), (100000, '#ppt_x')], 1000) + anim(s, p, 'ppt_y', [(0, '#ppt_y+.1'), (100000, '#ppt_y')], 1000, ' decel="100000"'))
def e_grow_turn(s, p=None, node='clickEffect'): return effect(31, 'entr', 0, node, vis(s, p, 'visible') + anim(s, p, 'ppt_w', [(0, '0'), (100000, '#ppt_w')]) + anim(s, p, 'ppt_h', [(0, '0'), (100000, '#ppt_h')]) + anim(s, p, 'style.rotation', [(0, '90'), (100000, '0')]) + fx(s, p, 'fade'))
def e_zoom(s, p=None, node='clickEffect'): return effect(53, 'entr', 16, node, vis(s, p, 'visible') + anim(s, p, 'ppt_w', [(0, '0'), (100000, '#ppt_w')]) + anim(s, p, 'ppt_h', [(0, '0'), (100000, '#ppt_h')]) + fx(s, p, 'fade'))
def e_filter(s, filt, pid, node='clickEffect'): return effect(pid, 'entr', 0, node, vis(s, None, 'visible') + fx(s, None, filt, dur=800))
def x_fly_right(s, node='clickEffect'): return effect(2, 'exit', 2, node, anim(s, None, 'ppt_x', [(0, '#ppt_x'), (100000, '1+#ppt_w/2')]) + anim(s, None, 'ppt_y', [(0, '#ppt_y'), (100000, '#ppt_y')]) + vis(s, None, 'hidden').replace('dur="1"', 'dur="1"').replace('<p:cond delay="0"/>', '<p:cond delay="499"/>', 1))
def m_spin(s, node='clickEffect'): return effect(8, 'emph', 0, node, f'<p:animRot by="21600000"><p:cBhvr>{ctn(2000)}<p:tgtEl>{tgt(s)}</p:tgtEl><p:attrNameLst><p:attrName>r</p:attrName></p:attrNameLst></p:cBhvr></p:animRot>')
def m_grow(s, node='clickEffect'): return effect(6, 'emph', 0, node, f'<p:animScale><p:cBhvr>{ctn(2000)}<p:tgtEl>{tgt(s)}</p:tgtEl></p:cBhvr><p:by x="150000" y="150000"/></p:animScale>')
def m_pulse(s, node='clickEffect'): return effect(26, 'emph', 0, node, f'<p:animScale><p:cBhvr>{ctn(250, 0, " autoRev=\"1\"")}<p:tgtEl>{tgt(s)}</p:tgtEl></p:cBhvr><p:by x="110000" y="110000"/></p:animScale>')
def m_transp(s, node='clickEffect'): return effect(9, 'emph', 0, node, f'<p:set><p:cBhvr>{ctn(2000)}<p:tgtEl>{tgt(s)}</p:tgtEl><p:attrNameLst><p:attrName>style.opacity</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="0.5"/></p:to></p:set>' + fx(s, None, 'image', 'in', 2000, 'opacity: 0.5'))
def m_path(s, node='clickEffect'): return effect(42, 'path', 0, node, f'<p:animMotion origin="layout" path="M 0 0 L 0.25 0.1 E" pathEditMode="relative" ptsTypes="AA"><p:cBhvr>{ctn(2000)}<p:tgtEl>{tgt(s)}</p:tgtEl><p:attrNameLst><p:attrName>ppt_x</p:attrName><p:attrName>ppt_y</p:attrName></p:attrNameLst></p:cBhvr><p:rCtr x="12500" y="5000"/></p:animMotion>')

# 1. elenco puntato per paragrafo
s1 = prs.slides.add_slide(bullets); s1.shapes.title.text = 'Elenco per paragrafo'
body = s1.placeholders[1]; tf = body.text_frame; tf.text = 'Primo punto'
for t in ['Secondo punto', 'Terzo punto']: tf.add_paragraph().text = t
b = body.shape_id
timing(s1, [click(e_fade(b, 0)), click(e_fly_left(b, 1)), click(e_float_in(b, 2))],
       f'<p:bldLst><p:bldP spid="{b}" grpId="0" build="p"/></p:bldLst>')
trans(s1, '<p:wheel spokes="1"/>')

# 2. ingressi con maschere e trasformazioni
s2 = prs.slides.add_slide(blank)
cols = ['C0392B', '2980B9', '27AE60', '8E44AD', 'D35400', '16A085', '2C3E50', 'F39C12', '7F8C8D', 'E84393']
names = [('Ruota', 'wheel(1)', 21), ('Veneziane', 'blinds(horizontal)', 3), ('Scacchiera', 'checkerboard(across)', 5), ('Rombo', 'diamond(in)', 8), ('Più', 'plus(out)', 13),
         ('Barre casuali', 'randombar(horizontal)', 14), ('Strisce', 'strips(downRight)', 18), ('Dividi', 'barn(inVertical)', 16)]
ids = []
for i, (nm, f, pid) in enumerate(names):
    sh = box(s2, nm, 0.4 + (i % 4) * 3.2, 0.5 + (i // 4) * 1.7, 2.9, 1.4, cols[i]); ids.append((sh.shape_id, f, pid))
gt = box(s2, 'Cresci e ruota', 0.4, 4.3, 3.9, 1.3, cols[8]); zm = box(s2, 'Zoom', 4.6, 4.3, 3.9, 1.3, cols[9])
timing(s2, [click(*[e_filter(i, f, pid, 'clickEffect' if k == 0 else 'withEffect') for k, (i, f, pid) in enumerate(ids)]), click(e_grow_turn(gt.shape_id), e_zoom(zm.shape_id, node='withEffect'))])
trans(s2, '<p:blinds dir="vert"/>')

# 3. enfasi e percorso: lo stato finale resta
s3 = prs.slides.add_slide(blank)
sp = box(s3, 'Rotazione', 0.6, 0.6, 3, 1.5, '2980B9'); gr = box(s3, 'Ingrandisci', 4.6, 0.6, 3, 1.5, '27AE60')
tr_ = box(s3, 'Trasparenza', 8.6, 0.6, 3, 1.5, '8E44AD'); pa = box(s3, 'Percorso', 0.6, 4, 3, 1.5, 'D35400'); pu = box(s3, 'Impulso', 4.6, 4, 3, 1.5, 'C0392B')
ex = box(s3, 'Esce a destra', 8.6, 4, 3, 1.5, '2C3E50')
timing(s3, [click(m_spin(sp.shape_id), m_grow(gr.shape_id, 'withEffect'), m_transp(tr_.shape_id, 'withEffect')), click(m_path(pa.shape_id), m_pulse(pu.shape_id, 'withEffect')), click(x_fly_right(ex.shape_id))])
trans(s3, '<p:checker dir="vert"/>')

# 4-8. transizioni
for k, (title, xml, p14) in enumerate([('Barre casuali', '<p:randomBar dir="vert"/>', False), ('Strisce', '<p:strips dir="rd"/>', False), ('Rombo', '<p:diamond/>', False),
                                        ('Più', '<p:plus/>', False), ('Tende', '<p15:prstTrans prst="curtains"/>', True)]):
    s = prs.slides.add_slide(blank); box(s, 'Transizione: ' + title, 1, 2.8, 11.3, 1.8, cols[k]); trans(s, xml, p14)

prs.save(OUT)
print('ok', OUT)
