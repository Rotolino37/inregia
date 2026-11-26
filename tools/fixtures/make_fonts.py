"""Fixture per i test dei font (tests/fixtures):
- cloudfonts/InRegia Prova/104729.ttf : font assente dal sistema, nella struttura dei font cloud di Office
- fonts.pptx : testo in "InRegia Prova" (grassetto), in "InRegia Incorporato" (incorporato nel file come .fntdata EOT
  con cifratura XOR, come PowerPoint) e in "Font Inesistente XYZ" (introvabile, deve dare un avviso).
I font derivano da DejaVu Sans (licenza Bitstream Vera: modifiche ammesse con nome diverso).
Richiede fontTools, python-pptx, lxml.
"""
import os, struct, zipfile, shutil
from fontTools.ttLib import TTFont
from pptx import Presentation
from pptx.util import Inches, Pt
from lxml import etree

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, '..', '..', 'tests', 'fixtures')
SRC = '/usr/share/fonts/truetype/dejavu/'


def renamed(src, family, sub, out):
    f = TTFont(src)
    nm = f['name']
    ps = family.replace(' ', '') + '-' + sub.replace(' ', '')
    for rec in list(nm.names):
        if rec.nameID in (1, 2, 3, 4, 6, 16, 17, 21, 22):
            nm.removeNames(nameID=rec.nameID)
    for pid, eid, lid in ((3, 1, 0x409), (1, 0, 0)):
        nm.setName(family, 1, pid, eid, lid); nm.setName(sub, 2, pid, eid, lid)
        nm.setName(f'{family} {sub}; prova InRegia', 3, pid, eid, lid); nm.setName(f'{family} {sub}', 4, pid, eid, lid); nm.setName(ps, 6, pid, eid, lid)
    f['OS/2'].fsType = 0
    from fontTools import subset  # solo ASCII: fixture piccola
    sub_ = subset.Subsetter(subset.Options()); sub_.populate(unicodes=range(0x20, 0x7f)); sub_.subset(f)
    f.save(out)
    return out


def eot(ttf_bytes, family, xor=True):
    data = bytes(b ^ 0x50 for b in ttf_bytes) if xor else ttf_bytes
    fam = family.encode('utf-16le')
    def s(b): return struct.pack('<H', len(b)) + b
    names = s(fam) + struct.pack('<H', 0) + s('Regular'.encode('utf-16le')) + struct.pack('<H', 0) + s(b'') + struct.pack('<H', 0) + s(fam) + struct.pack('<H', 0) + s(b'')
    head_rest = bytes(10) + struct.pack('<BBIHH', 1, 0, 400, 0, 0x504C) + bytes(16) + bytes(8) + struct.pack('<I', 0) + bytes(16) + struct.pack('<H', 0)
    flags = 0x10000000 if xor else 0
    size = 16 + len(head_rest) + len(names) + len(data)
    return struct.pack('<IIII', size, len(data), 0x00020001, flags) + head_rest + names + data


cloud = os.path.join(FIX, 'cloudfonts', 'InRegia Prova'); os.makedirs(cloud, exist_ok=True)
renamed(SRC + 'DejaVuSans-Bold.ttf', 'InRegia Prova', 'Bold', os.path.join(cloud, '104729.ttf'))
emb_ttf = renamed(SRC + 'DejaVuSerif.ttf', 'InRegia Incorporato', 'Regular', '/tmp/inregia-incorporato.ttf')

prs = Presentation(); prs.slide_width = Inches(13.333); prs.slide_height = Inches(7.5)
s = prs.slides.add_slide(prs.slide_layouts[6])
def tb(txt, y, font, bold):
    b = s.shapes.add_textbox(Inches(0.5), Inches(y), Inches(12), Inches(1.6)); r = b.text_frame.paragraphs[0].add_run(); r.text = txt
    r.font.size = Pt(60); r.font.bold = bold; r.font.name = font
tb('#MMNRT cloud', 0.4, 'InRegia Prova', True)
tb('Incorporato', 2.6, 'InRegia Incorporato', False)
tb('Mancante', 4.8, 'Font Inesistente XYZ', False)
tmp = '/tmp/fonts-base.pptx'; prs.save(tmp)

# incorpora il font come fa PowerPoint: ppt/fonts/font1.fntdata + embeddedFontLst
P = 'http://schemas.openxmlformats.org/presentationml/2006/main'; R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
out = os.path.join(FIX, 'fonts.pptx')
with zipfile.ZipFile(tmp) as zi, zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zo:
    for it in zi.infolist():
        b = zi.read(it.filename)
        if it.filename == '[Content_Types].xml':
            b = b.replace(b'</Types>', b'<Default Extension="fntdata" ContentType="application/x-fontdata"/></Types>')
        elif it.filename == 'ppt/_rels/presentation.xml.rels':
            b = b.replace(b'</Relationships>', b'<Relationship Id="rIdFont1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font1.fntdata"/></Relationships>')
        elif it.filename == 'ppt/presentation.xml':
            d = etree.fromstring(b); root = d
            root.set('embedTrueTypeFonts', '1')
            lst = etree.Element(f'{{{P}}}embeddedFontLst')
            ef = etree.SubElement(lst, f'{{{P}}}embeddedFont'); etree.SubElement(ef, f'{{{P}}}font', typeface='InRegia Incorporato')
            rg = etree.SubElement(ef, f'{{{P}}}regular'); rg.set(f'{{{R}}}id', 'rIdFont1')
            # dopo notesSz (ordine dello schema)
            nsz = root.find(f'{{{P}}}notesSz'); nsz.addnext(lst)
            b = etree.tostring(d, xml_declaration=True, encoding='UTF-8', standalone=True)
        zo.writestr(it, b)
    zo.writestr('ppt/fonts/font1.fntdata', eot(open(emb_ttf, 'rb').read(), 'InRegia Incorporato'))
print('ok', out)
