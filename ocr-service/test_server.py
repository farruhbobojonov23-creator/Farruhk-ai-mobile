import io, unittest
from PIL import Image
from server import create_app, Cells
TOKEN='a'*32
class Fake:
    def predict(self,**kw):
        class R:
            json={'res':{'overall_ocr_res':{'rec_texts':['Поставщик: Тест']},'table_res_list':[{'pred_html':'<table><tr><td>Товар</td><td>Цена с НДС</td></tr><tr><td>Рис</td><td>100</td></tr></table>'}]}}
        return [R()]
class Test(unittest.TestCase):
    def setUp(self):self.c=create_app(Fake,TOKEN).test_client()
    def image(self):
        b=io.BytesIO();Image.new('RGB',(100,100)).save(b,'PNG');b.seek(0);return {'image':(b,'photo.png')}
    def test_auth(self):self.assertEqual(self.c.post('/v1/ocr',data=self.image()).status_code,401)
    def test_origin(self):self.assertEqual(self.c.post('/v1/ocr',headers={'Origin':'https://wrong.example','Authorization':'Bearer '+TOKEN},data=self.image()).status_code,403)
    def test_success(self):
        r=self.c.post('/v1/ocr',headers={'Origin':'https://appassets.androidplatform.net','Authorization':'Bearer '+TOKEN},data=self.image())
        self.assertEqual(r.status_code,200);self.assertEqual(r.json[0]['tables'][0][1],['Рис','100']);self.assertEqual(r.headers['Cache-Control'],'no-store')
    def test_spans(self):
        p=Cells();p.feed('<tr><td rowspan="2">Товар</td><td colspan="2">Цена</td></tr><tr><td>с НДС</td><td>Сумма</td></tr>')
        self.assertEqual(p.rows,[['Товар','Цена',''],['Товар','с НДС','Сумма']])
if __name__=='__main__':unittest.main()
