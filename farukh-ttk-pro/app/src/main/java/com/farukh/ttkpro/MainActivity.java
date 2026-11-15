package com.farukh.ttkpro;

import android.app.Activity;
import android.app.AlertDialog;
import android.print.PrintManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Matrix;
import android.graphics.pdf.PdfRenderer;
import java.io.File;
import java.io.FileOutputStream;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PageRange;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int INK=0xFF20222A, RED=0xFFC81C2C, RED2=0xFFE43B46, PALE=0xFFF8F7F6,
        GREY=0xFF6E7078, BORDER=0xFFE5E5EA, WHITE=Color.WHITE, DARK=0xFF14161E, BLUE=0xFF9EEAFA;
    private static final int PICK_PHOTO=101,SAVE_PDF=102,SAVE_BACKUP=103,LOAD_BACKUP=104;
    private TTKStore store;
    private LinearLayout content;
    private JSONObject editing;
    private boolean editingCategoryPhoto=false;
    private JSONObject photoCategory;
    private byte[] pendingPdf;
    private String updateManifestUrl="https://raw.githubusercontent.com/farruhbobojonov23-creator/Farruhk-ai-mobile/farukh-ttk-pro/farukh-ttk-pro/updates/latest.json";
    private Uri lastPdfUri;
    private EditText nameField,yieldField,piecesField,techField,qualityField,servingField,tempField,storageField,authorField,approverField,dateField;
    private Spinner catSpinner;
    private int tab=0;
    private final ArrayList<EditText> rowBrutto=new ArrayList<>(),rowNetto=new ArrayList<>();
    @Override public void onCreate(Bundle b){
        super.onCreate(b);
        getWindow().setStatusBarColor(DARK);getWindow().setNavigationBarColor(WHITE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        store=new TTKStore(this);home();
    }
    private int dp(float x){return (int)(getResources().getDisplayMetrics().density*x+.5f);}
    private GradientDrawable bg(int color,float radius){
        GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d;
    }
    private GradientDrawable border(int color,float radius,int line){
        GradientDrawable d=bg(color,radius);d.setStroke(dp(1),line);return d;
    }
    private GradientDrawable gradient(int a,int b,float radius){
        GradientDrawable d=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{a,b});d.setCornerRadius(dp(radius));return d;
    }
    private LinearLayout vertical(){LinearLayout l=new LinearLayout(this);l.setOrientation(1);return l;}
    private LinearLayout horizontal(){LinearLayout l=new LinearLayout(this);l.setOrientation(0);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
    private TextView text(String s,int sp,int color,boolean bold){
        TextView v=new TextView(this);v.setText(s);v.setTextColor(color);v.setTextSize(sp);
        v.setTypeface(Typeface.create("sans-serif",bold?Typeface.BOLD:Typeface.NORMAL));
        v.setGravity(Gravity.CENTER_VERTICAL);return v;
    }
    private void pad(View v,int x,int y){v.setPadding(dp(x),dp(y),dp(x),dp(y));}
    private LinearLayout.LayoutParams lp(int w,int h){return new LinearLayout.LayoutParams(w<0?w:dp(w),h<0?h:dp(h));}
    private void space(LinearLayout l,int h){View v=new View(this);l.addView(v,lp(1,h));}
    private TextView chip(String s,int col,int bg){
        TextView t=text(s,12,col,true);pad(t,10,8);t.setBackground(border(bg,10,BORDER));return t;
    }
    private TextView button(String s,boolean primary){
        TextView t=text(s,15,primary?WHITE:INK,true);t.setGravity(Gravity.CENTER);
        pad(t,15,14);t.setBackground(primary?gradient(RED,RED2,15):border(WHITE,15,BORDER));
        t.setElevation(dp(primary?3:1));return t;
    }
    private void addButton(LinearLayout parent,String label,boolean primary,View.OnClickListener click){
        TextView b=button(label,primary);LinearLayout.LayoutParams p=lp(-1,49);p.topMargin=dp(11);
        parent.addView(b,p);b.setOnClickListener(click);
    }
    private LinearLayout card(){
        LinearLayout c=vertical();pad(c,15,14);c.setBackground(border(WHITE,18,BORDER));return c;
    }
    private void base(String title,String subtitle,boolean back){
        LinearLayout shell=vertical();shell.setBackgroundColor(PALE);
        LinearLayout head=horizontal();head.setBackgroundColor(WHITE);pad(head,17,16);
        if(back){TextView a=text("‹",31,RED,true);head.addView(a,lp(35,44));a.setOnClickListener(v->home());}
        LinearLayout headline=vertical();TextView n=text(title,21,INK,true),s=text(subtitle,11,GREY,false);
        headline.addView(n);headline.addView(s);head.addView(headline,new LinearLayout.LayoutParams(0,dp(49),1f));
        TextView mark=text("A",30,RED,true);head.addView(mark);shell.addView(head);
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);
        content=vertical();pad(content,17,14);scroll.addView(content);
        shell.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        if(!back)bottom(shell);
        setContentView(shell);
    }
    private void bottom(LinearLayout shell){
        LinearLayout nav=horizontal();nav.setBackgroundColor(WHITE);pad(nav,6,9);
        String[] labels={"⌂\nГлавная","▤\nМои ТТК","▦\nБаза","⚙\nЕщё"};
        for(int i=0;i<labels.length;i++){
            final int at=i;
            TextView t=text(labels[i],12,tab==i?RED:GREY,tab==i);t.setGravity(Gravity.CENTER);
            nav.addView(t,new LinearLayout.LayoutParams(0,dp(52),1));
            t.setOnClickListener(v->{tab=at;if(at==0)home();if(at==1)allDishes(null);if(at==2)ingredientsScreen();if(at==3)settings();});
        }shell.addView(nav);
    }
    private void home(){
        tab=0;base("FARUKH TTK PRO","JAPANESE PRO  •  ТЕХНОЛОГИЧЕСКИЕ КАРТЫ",false);
        // Deep-ruby Japanese hero with a real food photograph from the user's library.
        LinearLayout hero=vertical();pad(hero,18,18);hero.setBackground(gradient(DARK,0xFF712633,23));
        TextView badge=text("✦  JAPANESE PRO  /  CHEF EDITION",11,BLUE,true);hero.addView(badge);
        space(hero,13);
        LinearLayout heroRow=horizontal();
        LinearLayout heroCopy=vertical();
        heroCopy.addView(text("Японская кухня.\\nТвои стандарты.",23,WHITE,true));
        space(heroCopy,7);
        heroCopy.addView(text("ТТК всегда под рукой",12,0xFFFFC8CE,true));
        heroRow.addView(heroCopy,new LinearLayout.LayoutParams(0,dp(126),1));
        ImageView heroPhoto=new ImageView(this);
        heroPhoto.setScaleType(ImageView.ScaleType.FIT_CENTER);
        heroPhoto.setBackground(bg(0x20FFFFFF,17));
        heroRow.addView(heroPhoto,lp(119,119));
        FoodPhotos.show(this,heroPhoto,"cold.png");
        hero.addView(heroRow);
        TextView description=text("Создавай профессиональные карты. Редактируй рецептуры и печатай цветные PDF формата А4.",13,0xFFEEDBE0,false);
        hero.addView(description);
        space(hero,15);
        TextView b=button("＋  Создать новую ТТК",true);hero.addView(b);
        b.setOnClickListener(v->edit(store.newDish(store.categories().get(0).optString("name"))));
        content.addView(hero);
        space(content,13);
        // Gentle Japanese calligraphy / wave accent in the approved red-white theme.
        LinearLayout stripe=horizontal();stripe.setGravity(Gravity.CENTER_VERTICAL);
        TextView blossom=text("❀  桜",18,RED,true);
        stripe.addView(blossom);
        TextView mark=text("  JAPAN  •  RECIPE STUDIO  •  A4  ",10,GREY,true);
        mark.setGravity(Gravity.CENTER);stripe.addView(mark,new LinearLayout.LayoutParams(0,dp(27),1));
        TextView torii=text("⛩",23,RED,true);stripe.addView(torii);
        content.addView(stripe);
        space(content,12);
        LinearLayout summ=horizontal();
        summ.addView(counter(""+store.dishes().size(),"ТТК"),new LinearLayout.LayoutParams(0,dp(73),1));
        View g=new View(this);summ.addView(g,lp(11,1));
        summ.addView(counter(""+store.ingredients().size(),"Ингредиентов"),new LinearLayout.LayoutParams(0,dp(73),1));
        content.addView(summ);space(content,20);
        LinearLayout ttl=horizontal();
        ttl.addView(text("Категории кухни",19,INK,true),new LinearLayout.LayoutParams(0,-2,1));
        TextView manage=chip("✎ НАСТРОИТЬ",RED,WHITE);ttl.addView(manage);
        manage.setOnClickListener(v->categoriesScreen());
        content.addView(ttl);space(content,11);
        GridLayout grid=new GridLayout(this);grid.setColumnCount(3);
        for(int i=0;i<store.categories().size();i++){
            JSONObject cat=store.categories().get(i);
            String catName=cat.optString("name");
            LinearLayout tile=vertical();tile.setGravity(Gravity.CENTER);
            pad(tile,5,7);tile.setBackground(border(WHITE,17,BORDER));
            ImageView image=new ImageView(this);
            image.setScaleType(ImageView.ScaleType.FIT_CENTER);
            image.setBackground(bg(0xFFF8F5F5,12));
            String photo=cat.optString("photo","");
            if(!photo.isEmpty()){
                try{image.setImageURI(Uri.parse(photo));}
                catch(Exception ignore){FoodPhotos.show(this,image,cat.optString("asset",FoodPhotos.categoryAsset(catName)));}
            }else{
                FoodPhotos.show(this,image,cat.optString("asset",FoodPhotos.categoryAsset(catName)));
            }
            tile.addView(image,lp(-1,80));
            space(tile,7);
            TextView label=text(catName,12,INK,true);
            label.setGravity(Gravity.CENTER);label.setMaxLines(2);
            tile.addView(label,lp(-1,39));
            GridLayout.LayoutParams p=new GridLayout.LayoutParams();
            p.width=(getResources().getDisplayMetrics().widthPixels-dp(52))/3;
            p.height=dp(143);
            p.setMargins(dp(3),dp(3),dp(3),dp(3));grid.addView(tile,p);
            tile.setOnClickListener(v->allDishes(catName));
            tile.setOnLongClickListener(v->{editCategory(cat);return true;});
        }
        content.addView(grid);space(content,15);
        addButton(content,"＋ Добавить категорию",false,v->editCategory(null));
        space(content,15);
        content.addView(text("Фото категорий загружаются из твоей библиотеки MORE SUSHI, затем доступны офлайн. Нажми на категорию для списка ТТК или удерживай для редактирования.",11,GREY,false));
        space(content,11);
        content.addView(text("Демо-данные требуют проверки рецептур, КБЖУ, аллергенов, температур и сроков хранения.",11,RED,false));
        space(content,23);
    }
    private LinearLayout counter(String big,String small){
        LinearLayout c=vertical();pad(c,13,9);c.setBackground(border(WHITE,16,BORDER));
        c.addView(text(big,23,RED,true));c.addView(text(small,11,GREY,false));return c;
    }
    private void allDishes(String category){
        tab=1;base(category==null?"Мои ТТК":category,"БИБЛИОТЕКА ТЕХНОЛОГИЧЕСКИХ КАРТ",category!=null);
        addButton(content,"＋ Создать новую ТТК",true,v->edit(store.newDish(category==null?store.categories().get(0).optString("name"):category)));
        space(content,14);
        int amount=0;
        for(JSONObject d:new ArrayList<>(store.dishes())){
            if(category!=null&&!category.equals(d.optString("category")))continue;
            amount++;
            LinearLayout tile=card();tile.addView(text(d.optString("name","Без названия"),17,INK,true));
            space(tile,5);tile.addView(text(d.optString("category")+"   •   "+d.optString("yield","")+" г",12,GREY,false));
            space(tile,10);
            LinearLayout action=horizontal();
            TextView e=chip("✎ Изменить",RED,0xFFFFF3F3),pdf=chip("▤ PDF",RED,0xFFFFF3F3);
            action.addView(e);spaceH(action,10);action.addView(pdf);tile.addView(action);
            e.setOnClickListener(v->edit(d));
            pdf.setOnClickListener(v->export(d));
            tile.setOnLongClickListener(v->{new AlertDialog.Builder(this).setTitle("Удалить ТТК?").setMessage(d.optString("name"))
                    .setNegativeButton("Отмена",null).setPositiveButton("Удалить",(a,b)->{store.dishes().remove(d);store.save();allDishes(category);}).show();return true;});
            LinearLayout.LayoutParams lp=lp(-1,-2);lp.bottomMargin=dp(11);content.addView(tile,lp);
        }
        if(amount==0)content.addView(text("Здесь пока нет ТТК. Создай первую карту для этой категории.",14,GREY,false));
    }
    private void spaceH(LinearLayout l,int w){View v=new View(this);l.addView(v,lp(w,1));}
    private void categoriesScreen(){
        base("Категории","РЕДАКТИРОВАНИЕ НАЗВАНИЙ И ИКОНОК",true);
        addButton(content,"＋ Добавить категорию",true,v->editCategory(null));
        space(content,14);
        for(JSONObject o:new ArrayList<>(store.categories())){
            LinearLayout item=card();item.addView(text(o.optString("icon")+"  "+o.optString("name"),16,INK,true));
            item.setOnClickListener(v->editCategory(o));LinearLayout.LayoutParams p=lp(-1,-2);p.bottomMargin=dp(9);content.addView(item,p);
        }
    }
    private void editCategory(JSONObject old){
        LinearLayout box=vertical();pad(box,18,10);
        EditText n=input(box,"Название категории",old==null?"":old.optString("name"),false);
        EditText icon=input(box,"Эмодзи / значок",old==null?"🍣":old.optString("icon"),false);
        AlertDialog.Builder dialog=new AlertDialog.Builder(this).setTitle(old==null?"Добавить категорию":"Изменить категорию").setView(box)
            .setNegativeButton("Отмена",null).setPositiveButton("Сохранить",(a,b)->{
                if(n.getText().toString().trim().isEmpty())return;
                JSONObject target=old;
                if(target==null){target=new JSONObject();store.categories().add(target);}
                try{target.put("name",n.getText().toString().trim());target.put("icon",icon.getText().toString());}catch(Exception ignore){}
                store.save();categoriesScreen();
            });
        if(old!=null)dialog.setNeutralButton("Изменить фото",(a,b)->choosePhoto(true,old));
        dialog.show();
    }
    private EditText input(LinearLayout host,String label,String value,boolean multi){
        TextView l=text(label,12,GREY,true);LinearLayout.LayoutParams pl=lp(-1,-2);pl.topMargin=dp(12);host.addView(l,pl);
        EditText e=new EditText(this);e.setText(value);e.setTextSize(15);e.setTextColor(INK);
        e.setSingleLine(!multi);if(multi){e.setMinLines(3);e.setGravity(Gravity.TOP);}
        pad(e,11,11);e.setBackground(border(WHITE,11,BORDER));
        LinearLayout.LayoutParams pe=lp(-1,-2);pe.topMargin=dp(6);host.addView(e,pe);return e;
    }
    private void edit(JSONObject dish){
        editing=dish;rowBrutto.clear();rowNetto.clear();
        base("Создание ТТК","JAPANESE PRO  •  А4  •  РЕДАКТОР",true);
        LinearLayout intro=card();
        TextView info=text("Все поля редактируются. Рецептура, технология, КБЖУ и сроки требуют проверки перед утверждением.",12,GREY,false);intro.addView(info);
        content.addView(intro);space(content,13);
        nameField=input(content,"НАЗВАНИЕ БЛЮДА",dish.optString("name"),false);
        TextView pbtn=button("📷  Добавить / заменить фото блюда",false);LinearLayout.LayoutParams pp=lp(-1,50);pp.topMargin=dp(12);content.addView(pbtn,pp);
        pbtn.setOnClickListener(v->choosePhoto(false,null));
        TextView catLabel=text("КАТЕГОРИЯ",12,GREY,true);LinearLayout.LayoutParams lbl=lp(-1,-2);lbl.topMargin=dp(16);content.addView(catLabel,lbl);
        ArrayList<String> cs=new ArrayList<>();
        int selected=0;
        for(int i=0;i<store.categories().size();i++){
            String n=store.categories().get(i).optString("name");cs.add(n);
            if(n.equals(dish.optString("category")))selected=i;
        }
        catSpinner=new Spinner(this);
        ArrayAdapter<String> ca=new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,cs);
        catSpinner.setAdapter(ca);catSpinner.setSelection(selected);content.addView(catSpinner,lp(-1,51));
        LinearLayout xy=horizontal();yieldField=fieldInline(xy,"Выход, г",dish.optString("yield","260"));
        spaceH(xy,10);piecesField=fieldInline(xy,"Количество, шт",dish.optString("pieces","8"));
        content.addView(xy);space(content,18);
        content.addView(text("ШАБЛОН ТТК • СВЕТЛЫЙ ЯПОНСКИЙ",13,GREY,true));space(content,9);
        HorizontalScrollView templateScroller=new HorizontalScrollView(this);
        templateScroller.setHorizontalScrollBarEnabled(false);
        LinearLayout templates=horizontal();pad(templates,2,3);
        for(int i=0;i<4;i++){
            final int at=i,selected=dish.optInt("template",0);
            LinearLayout t=vertical();t.setGravity(Gravity.CENTER);
            pad(t,8,9);t.setBackground(border(i==selected?0xFFFFF0F2:WHITE,13,i==selected?RED:BORDER));
            TemplateThumbnail thumbnail=new TemplateThumbnail(this,i,i==selected);
            t.addView(thumbnail,lp(90,122));
            TextView name=text(TTKStore.TEMPLATE_NAMES[i],12,i==selected?RED:INK,true);
            name.setGravity(Gravity.CENTER);
            t.addView(name,lp(-1,28));
            LinearLayout.LayoutParams wt=lp(109,162);wt.setMargins(dp(3),dp(2),dp(7),dp(2));
            templates.addView(t,wt);
            t.setOnClickListener(v->{
                saveEditor();
                try{dish.put("template",at);}catch(Exception ignore){}
                store.save();edit(dish);
            });
        }
        templateScroller.addView(templates);content.addView(templateScroller);
        space(content,13);
        TextView preview=button("▣  Посмотреть выбранный лист А4",false);
        content.addView(preview,lp(-1,45));
        preview.setOnClickListener(v->{saveEditor();previewPdf(dish);});
        space(content,19);
        TextView recipeTitle=text("РЕЦЕПТУРА · БРУТТО / НЕТТО",16,INK,true);content.addView(recipeTitle);space(content,8);
        JSONArray rows=dish.optJSONArray("rows");
        if(rows==null)rows=new JSONArray();
        for(int i=0;i<rows.length();i++){
            final int idx=i;JSONObject r=rows.optJSONObject(i);if(r==null)continue;
            LinearLayout rr=card();rr.addView(text((i+1)+". "+r.optString("name"),14,INK,true));space(rr,7);
            LinearLayout row=horizontal();
            EditText br=fieldInline(row,"Брутто, г",String.format(Locale.US,"%.1f",r.optDouble("brutto",0)));
            spaceH(row,9);EditText net=fieldInline(row,"Нетто, г",String.format(Locale.US,"%.1f",r.optDouble("netto",0)));
            rowBrutto.add(br);rowNetto.add(net);rr.addView(row);
            TextView delete=chip("✕ Удалить",RED,0xFFFFF4F5);LinearLayout.LayoutParams pd=lp(-2,-2);pd.topMargin=dp(5);rr.addView(delete,pd);
            delete.setOnClickListener(v->{saveEditor();JSONArray newer=new JSONArray();JSONArray all=dish.optJSONArray("rows");
                for(int j=0;j<all.length();j++)if(j!=idx)newer.put(all.optJSONObject(j));
                try{dish.put("rows",newer);}catch(Exception ignore){}store.save();edit(dish);});
            LinearLayout.LayoutParams pr=lp(-1,-2);pr.bottomMargin=dp(8);content.addView(rr,pr);
        }
        addButton(content,"＋ Добавить ингредиент",false,v->{saveEditor();addIngredientRow(dish);});
        space(content,18);
        techField=input(content,"ТЕХНОЛОГИЯ ПРИГОТОВЛЕНИЯ",dish.optString("tech"),true);
        addButton(content,"↻ Предложить технологию по категории",false,v->new AlertDialog.Builder(this)
            .setTitle("Заменить технологию?").setMessage("Текущий текст будет заменён шаблоном выбранной категории.")
            .setNegativeButton("Отмена",null).setPositiveButton("Заменить",(a,b)->techField.setText(TTKStore.defaultTechnology(cs.get(catSpinner.getSelectedItemPosition())))).show());
        qualityField=input(content,"ТРЕБОВАНИЯ К КАЧЕСТВУ",dish.optString("quality"),true);
        servingField=input(content,"ПОДАЧА И ОФОРМЛЕНИЕ",dish.optString("serving"),true);
        tempField=input(content,"ТЕМПЕРАТУРА ХРАНЕНИЯ",dish.optString("temp"),false);
        storageField=input(content,"СРОК ХРАНЕНИЯ",dish.optString("storage"),false);
        authorField=input(content,"РАЗРАБОТАЛ",dish.optString("author"),false);
        approverField=input(content,"УТВЕРЖДАЮ",dish.optString("approver"),false);
        dateField=input(content,"ДАТА",dish.optString("date"),false);
        space(content,14);
        addButton(content,"СОХРАНИТЬ ТТК",true,v->{saveEditor();allDishes(null);});
        addButton(content,"▤  СОХРАНИТЬ PDF • А4",false,v->{saveEditor();export(dish);});
        addButton(content,"◉  ПРЕДПРОСМОТР / ПЕЧАТЬ А4",false,v->{
            saveEditor();
            try{pendingPdf=PdfMaker.generate(this,store,dish);printPdf();}
            catch(Exception err){new AlertDialog.Builder(this).setTitle("Ошибка печати")
                .setMessage(err.getMessage()).setPositiveButton("Закрыть",null).show();}
        });
        space(content,23);
    }
    private EditText fieldInline(LinearLayout row,String label,String value){
        LinearLayout column=vertical();column.addView(text(label,11,GREY,true));
        EditText e=new EditText(this);e.setSingleLine(true);e.setText(value);e.setTextSize(15);e.setTextColor(INK);
        e.setBackground(border(WHITE,10,BORDER));pad(e,9,9);space(column,4);column.addView(e,lp(-1,45));
        row.addView(column,new LinearLayout.LayoutParams(0,-2,1));return e;
    }
    private void saveEditor(){
        if(editing==null||nameField==null)return;
        try{
            editing.put("name",nameField.getText().toString());
            editing.put("category",catSpinner.getSelectedItem().toString());
            editing.put("yield",yieldField.getText().toString());
            editing.put("pieces",piecesField.getText().toString());
            editing.put("tech",techField.getText().toString());
            editing.put("quality",qualityField.getText().toString());
            editing.put("serving",servingField.getText().toString());
            editing.put("temp",tempField.getText().toString());
            editing.put("storage",storageField.getText().toString());
            editing.put("author",authorField.getText().toString());
            editing.put("approver",approverField.getText().toString());
            editing.put("date",dateField.getText().toString());
            JSONArray rows=editing.optJSONArray("rows");
            if(rows!=null)for(int i=0;i<rows.length()&&i<rowBrutto.size();i++){
                JSONObject r=rows.optJSONObject(i);if(r==null)continue;
                r.put("brutto",number(rowBrutto.get(i).getText().toString()));
                r.put("netto",number(rowNetto.get(i).getText().toString()));
            }
            if(!store.dishes().contains(editing))store.dishes().add(editing);
            store.save();
        }catch(Exception ignore){}
    }
    private double number(String s){try{return Double.parseDouble(s.replace(',','.'));}catch(Exception e){return 0;}}
    private void addIngredientRow(JSONObject d){
        ArrayList<String> names=new ArrayList<>();
        for(JSONObject o:store.ingredients())names.add(o.optString("name"));
        final int[] selection={0};
        new AlertDialog.Builder(this).setTitle("Выбери ингредиент")
           .setSingleChoiceItems(names.toArray(new String[0]),0,(a,i)->selection[0]=i)
           .setNeutralButton("＋ Новый", (a,b)->customIngredientRow(d))
           .setNegativeButton("Отмена",null)
           .setPositiveButton("Добавить",(a,b)->{
               JSONArray rows=d.optJSONArray("rows");if(rows==null)rows=new JSONArray();
               rows.put(TTKStore.row(names.get(selection[0]),0,0));
               try{d.put("rows",rows);}catch(Exception ignore){}store.save();edit(d);
           }).show();
    }
    private void customIngredientRow(JSONObject d){
        LinearLayout box=vertical();pad(box,18,10);
        EditText n=input(box,"Название", "",false),b=input(box,"Брутто, г","0",false),net=input(box,"Нетто, г","0",false);
        new AlertDialog.Builder(this).setTitle("Свободный ингредиент").setView(box)
            .setPositiveButton("Добавить",(a,z)->{JSONArray arr=d.optJSONArray("rows");if(arr==null)arr=new JSONArray();
                arr.put(TTKStore.row(n.getText().toString(),number(b.getText().toString()),number(net.getText().toString())));
                try{d.put("rows",arr);}catch(Exception ignore){}store.save();edit(d);})
            .setNegativeButton("Отмена",null).show();
    }
    private void ingredientsScreen(){
        tab=2;base("База ингредиентов","КБЖУ НА 100 Г • РЕДАКТИРОВАНИЕ",false);
        addButton(content,"＋ Добавить ингредиент",true,v->editIngredient(null));
        space(content,10);
        content.addView(text("Демонстрационные показатели необходимо сверить с упаковкой и рецептурой производителя.",12,GREY,false));
        space(content,14);
        for(JSONObject o:new ArrayList<>(store.ingredients())){
            LinearLayout card=card();card.addView(text(o.optString("name"),15,INK,true));
            space(card,5);
            card.addView(text("Ккал "+o.optDouble("kcal")+"  •  Б "+o.optDouble("p")+"  •  Ж "+o.optDouble("f")+"  •  У "+o.optDouble("c"),12,GREY,false));
            if(!o.optString("allergen").isEmpty()){space(card,4);card.addView(text("Аллергены: "+o.optString("allergen"),11,RED,false));}
            card.setOnClickListener(v->editIngredient(o));LinearLayout.LayoutParams p=lp(-1,-2);p.bottomMargin=dp(9);content.addView(card,p);
        }
    }
    private void editIngredient(JSONObject old){
        LinearLayout box=vertical();pad(box,18,12);
        EditText name=input(box,"Наименование",old==null?"":old.optString("name"),false);
        EditText kcal=input(box,"Ккал / 100 г",old==null?"0":old.optString("kcal"),false);
        EditText pr=input(box,"Белки / 100 г",old==null?"0":old.optString("p"),false);
        EditText fat=input(box,"Жиры / 100 г",old==null?"0":old.optString("f"),false);
        EditText carb=input(box,"Углеводы / 100 г",old==null?"0":old.optString("c"),false);
        EditText alleg=input(box,"Аллергены по этикетке",old==null?"":old.optString("allergen"),true);
        ScrollView scroll=new ScrollView(this);scroll.addView(box);
        new AlertDialog.Builder(this).setTitle(old==null?"Новый ингредиент":"Изменить ингредиент").setView(scroll)
         .setNegativeButton("Отмена",null).setPositiveButton("Сохранить",(a,b)->{
             if(name.getText().toString().trim().isEmpty())return;
             JSONObject target=old;if(target==null){target=new JSONObject();store.ingredients().add(target);}
             try{
                 target.put("name",name.getText().toString().trim());
                 target.put("kcal",number(kcal.getText().toString()));target.put("p",number(pr.getText().toString()));
                 target.put("f",number(fat.getText().toString()));target.put("c",number(carb.getText().toString()));
                 target.put("allergen",alleg.getText().toString());
             }catch(Exception ignore){}
             store.save();ingredientsScreen();
         }).show();
    }
    private void settings(){
        tab=3;base("Настройки","FARUKH TTK PRO • V0.3 TEST",false);
        content.addView(text("Настройка каталога",18,INK,true));
        addButton(content,"Категории / иконки",false,v->categoriesScreen());
        addButton(content,"База ингредиентов",false,v->ingredientsScreen());
        space(content,20);
        content.addView(text("Обновления",18,INK,true));
        space(content,9);
        content.addView(text("Версия 0.4 Preview • обновления поверх приложения сохраняют данные при одинаковой цифровой подписи.",13,GREY,false));
        addButton(content,"⟳  Проверить обновления",true,v->checkForUpdates());
        space(content,20);
        content.addView(text("Резервная копия",18,INK,true));
        space(content,8);
        content.addView(text("Сохраняй копию ТТК перед крупными обновлениями. Картинки, выбранные из памяти телефона, остаются внешними файлами — их желательно сохранить отдельно.",12,GREY,false));
        addButton(content,"↓  Сохранить базу ТТК (.json)",false,v->exportBackup());
        addButton(content,"↑  Восстановить базу ТТК (.json)",false,v->importBackup());
        space(content,20);
        content.addView(text("О сохранении PDF",18,INK,true));
        space(content,10);
        content.addView(text("При сохранении система Android предложит выбрать папку или Google Диск через системный файловый менеджер. Автоматическая фоновая синхронизация с Google Диском пока не реализована.",13,GREY,false));
        space(content,22);
        content.addView(text("Профессиональная проверка",18,INK,true));
        space(content,8);
        content.addView(text("Демонстрационные рецептуры, расчёты и режимы не являются утверждённой ТТК. Перед производственным использованием необходимо проверить нормы, технологию, безопасность, пищевую ценность, аллергены и оформить утверждение.",13,GREY,false));
    }
    private void choosePhoto(boolean category,JSONObject c){
        editingCategoryPhoto=category;photoCategory=c;
        Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("image/*");
        i.addCategory(Intent.CATEGORY_OPENABLE);i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(i,PICK_PHOTO);
    }
    private void previewPdf(JSONObject dish){
        try{
            pendingPdf=PdfMaker.generate(this,store,dish);
            File temp=new File(getCacheDir(),"farukh_ttk_preview.pdf");
            try(FileOutputStream out=new FileOutputStream(temp)){out.write(pendingPdf);}
            Bitmap bitmap=Bitmap.createBitmap(1190,1684,Bitmap.Config.ARGB_8888);
            try(ParcelFileDescriptor fd=ParcelFileDescriptor.open(temp,ParcelFileDescriptor.MODE_READ_ONLY);
                PdfRenderer renderer=new PdfRenderer(fd)){
                if(renderer.getPageCount()!=1)throw new Exception("Ошибка PDF: документ должен содержать ровно один лист A4");
                try(PdfRenderer.Page page=renderer.openPage(0)){
                    page.render(bitmap,null,new Matrix(){{
                        postScale(2,2);
                    }},PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                }
            }
            LinearLayout screen=vertical();
            screen.setBackgroundColor(0xFFF3F3F5);
            LinearLayout tools=horizontal();tools.setBackgroundColor(WHITE);pad(tools,9,9);
            TextView close=chip("‹ Назад",RED,WHITE);
            TextView save=chip("↓ PDF",RED,WHITE);
            TextView print=chip("▤ Печать",RED,WHITE);
            tools.addView(close,new LinearLayout.LayoutParams(0,dp(43),1));
            spaceH(tools,5);
            tools.addView(save,new LinearLayout.LayoutParams(0,dp(43),1));
            spaceH(tools,5);
            tools.addView(print,new LinearLayout.LayoutParams(0,dp(43),1));
            screen.addView(tools);
            ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);pad(scroll,7,9);
            ImageView preview=new ImageView(this);preview.setAdjustViewBounds(true);
            preview.setScaleType(ImageView.ScaleType.FIT_CENTER);
            preview.setBackgroundColor(WHITE);preview.setImageBitmap(bitmap);
            scroll.addView(preview,lp(-1,-2));
            screen.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
            final android.app.Dialog dialog=new android.app.Dialog(this);
            dialog.setContentView(screen);
            dialog.getWindow().setLayout(-1,-1);
            dialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
            close.setOnClickListener(v->dialog.dismiss());
            save.setOnClickListener(v->{dialog.dismiss();export(dish);});
            print.setOnClickListener(v->printPdf());
            dialog.show();
            dialog.getWindow().setLayout(-1,-1);
        }catch(Exception e){
            new AlertDialog.Builder(this).setTitle("Не удалось показать А4")
                .setMessage(e.getMessage()).setPositiveButton("Закрыть",null).show();
        }
    }
    private void export(JSONObject d){
        try{
            pendingPdf=PdfMaker.generate(this,store,d);
            Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.setType("application/pdf");intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.putExtra(Intent.EXTRA_TITLE,"TTK_"+d.optString("name","farukh").replaceAll("[^a-zA-Zа-яА-Я0-9_-]","_")+".pdf");
            startActivityForResult(intent,SAVE_PDF);
        }catch(Exception ex){new AlertDialog.Builder(this).setTitle("PDF не создан")
            .setMessage(ex.getMessage()).setPositiveButton("Понятно",null).show();}
    }
    @Override protected void onActivityResult(int req,int result,Intent data){
        super.onActivityResult(req,result,data);
        if(result!=RESULT_OK||data==null||data.getData()==null)return;
        Uri uri=data.getData();
        if(req==PICK_PHOTO){
            try{getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(Exception ignore){}
            try{
                if(editingCategoryPhoto&&photoCategory!=null){photoCategory.put("photo",uri.toString());store.save();categoriesScreen();}
                else if(editing!=null){editing.put("photo",uri.toString());store.save();edit(editing);}
            }catch(Exception ex){Toast.makeText(this,"Ошибка фотографии",Toast.LENGTH_LONG).show();}
        }
        if(req==SAVE_BACKUP){
            try(OutputStream out=getContentResolver().openOutputStream(uri)){
                if(out==null)throw new Exception("Нет доступа к файлу");
                out.write(store.backup().toString(2).getBytes(StandardCharsets.UTF_8));
                Toast.makeText(this,"Резервная копия сохранена",Toast.LENGTH_LONG).show();
            }catch(Exception e){Toast.makeText(this,"Ошибка копии: "+e.getMessage(),Toast.LENGTH_LONG).show();}
            return;
        }
        if(req==LOAD_BACKUP){
            new AlertDialog.Builder(this).setTitle("Восстановить базу?")
             .setMessage("Все текущие ТТК, категории и ингредиенты будут заменены данными из резервной копии.")
             .setNegativeButton("Отмена",null).setPositiveButton("Восстановить",(d,w)->{
                try(InputStream in=getContentResolver().openInputStream(uri)){
                    if(in==null)throw new Exception("Нет доступа к файлу");
                    ByteArrayOutputStream out=new ByteArrayOutputStream();
                    byte[] buf=new byte[4096];int n;
                    while((n=in.read(buf))!=-1){
                        if(out.size()+n>5*1024*1024)throw new Exception("Файл слишком большой");
                        out.write(buf,0,n);
                    }
                    store.restore(out.toString("UTF-8"));Toast.makeText(this,"База восстановлена",Toast.LENGTH_LONG).show();home();
                }catch(Exception e){
                    new AlertDialog.Builder(this).setTitle("Ошибка восстановления").setMessage(e.getMessage()).setPositiveButton("Закрыть",null).show();
                }
             }).show();
            return;
        }
        if(req==SAVE_PDF&&pendingPdf!=null){
            try(OutputStream out=getContentResolver().openOutputStream(uri)){
                if(out==null)throw new Exception("Нет доступа к файлу");out.write(pendingPdf);
                lastPdfUri=uri;
                new AlertDialog.Builder(this).setTitle("PDF A4 сохранён")
                    .setMessage("ТТК сохранена в выбранном месте. Теперь можно напечатать или отправить документ.")
                    .setPositiveButton("Поделиться",(a,b)->sharePdf(uri))
                    .setNeutralButton("Печать",(a,b)->printPdf())
                    .setNegativeButton("Закрыть",null).show();
            }catch(Exception ex){Toast.makeText(this,"Ошибка PDF: "+ex.getMessage(),Toast.LENGTH_LONG).show();}
        }
    }
    private void exportBackup(){
        Intent in=new Intent(Intent.ACTION_CREATE_DOCUMENT);
        in.setType("application/json");in.addCategory(Intent.CATEGORY_OPENABLE);
        in.putExtra(Intent.EXTRA_TITLE,"FARUKH_TTK_PRO_backup.json");
        startActivityForResult(in,SAVE_BACKUP);
    }
    private void importBackup(){
        Intent in=new Intent(Intent.ACTION_OPEN_DOCUMENT);
        in.setType("application/json");in.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(in,LOAD_BACKUP);
    }
    private void checkForUpdates(){
        Toast.makeText(this,"Проверка обновлений…",Toast.LENGTH_SHORT).show();
        new Thread(()->{
            String error=null;JSONObject update=null;HttpURLConnection cn=null;
            try{
                cn=(HttpURLConnection)new URL(updateManifestUrl).openConnection();
                cn.setConnectTimeout(8000);cn.setReadTimeout(8000);
                cn.setRequestProperty("Accept","application/json");
                if(cn.getResponseCode()!=200)throw new Exception("Сервер: "+cn.getResponseCode());
                ByteArrayOutputStream out=new ByteArrayOutputStream();
                try(InputStream in=cn.getInputStream()){
                    byte[] buf=new byte[4096];int n;
                    while((n=in.read(buf))!=-1){
                        if(out.size()+n>20000)throw new Exception("Некорректный ответ сервера");
                        out.write(buf,0,n);
                    }
                }
                update=new JSONObject(out.toString("UTF-8"));
                if(!"com.farukh.ttkpro.premium".equals(update.optString("packageId")))throw new Exception("Неправильный идентификатор пакета");
            }catch(Exception e){error=e.getMessage();}
            finally{if(cn!=null)cn.disconnect();}
            final String message=error;
            final JSONObject info=update;
            runOnUiThread(()->{
                if(message!=null){
                    new AlertDialog.Builder(this).setTitle("Не удалось проверить обновления")
                        .setMessage(message+"\\nТвои данные сохранены. Попробуй позже.")
                        .setPositiveButton("Понятно",null).show();return;
                }
                int latest=info.optInt("versionCode",0);
                int installed=4;
                if(latest<=installed){
                    new AlertDialog.Builder(this).setTitle("Обновлений нет")
                        .setMessage("Установлена версия 0.4 Preview. Новые версии появятся после проверки и выпуска.")
                        .setPositiveButton("Закрыть",null).show();
                    return;
                }
                String url=info.optString("downloadUrl","");
                String release=info.optString("versionName","новая");
                String notes=info.optString("notes","");
                if(!url.startsWith("https://")){
                    new AlertDialog.Builder(this).setTitle("Обновление ожидает публикации")
                      .setMessage("Новая версия "+release+" ещё не доступна для скачивания.")
                      .setPositiveButton("Закрыть",null).show();
                    return;
                }
                new AlertDialog.Builder(this).setTitle("Доступна версия "+release)
                    .setMessage(notes+"\\nДанные сохранятся, если подписанный пакет соответствует установленному приложению.")
                    .setNegativeButton("Позже",null).setPositiveButton("Скачать",(d,w)->{
                        startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));
                    }).show();
            });
        }).start();
    }
    private void sharePdf(Uri uri){
        Intent send=new Intent(Intent.ACTION_SEND);send.setType("application/pdf");
        send.putExtra(Intent.EXTRA_STREAM,uri);
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(Intent.createChooser(send,"Поделиться ТТК"));
    }
    private void printPdf(){
        if(pendingPdf==null)return;
        PrintManager manager=(PrintManager)getSystemService(Context.PRINT_SERVICE);
        PrintDocumentAdapter adapter=new PrintDocumentAdapter(){
            @Override public void onLayout(PrintAttributes oldAttr,PrintAttributes newAttr,
                CancellationSignal cancel,LayoutResultCallback callback,Bundle extras){
                callback.onLayoutFinished(new PrintDocumentInfo.Builder("FARUKH_TTK_PRO.pdf")
                    .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT).setPageCount(1).build(),true);
            }
            @Override public void onWrite(PageRange[] pages,ParcelFileDescriptor destination,
                CancellationSignal signal,WriteResultCallback callback){
                try(FileOutputStream out=new FileOutputStream(destination.getFileDescriptor())){
                    out.write(pendingPdf);out.flush();callback.onWriteFinished(new PageRange[]{PageRange.ALL_PAGES});
                }catch(Exception ex){callback.onWriteFailed(ex.getMessage());}
            }
        };
        manager.print("FARUKH TTK PRO",adapter,new PrintAttributes.Builder()
            .setMediaSize(PrintAttributes.MediaSize.ISO_A4).setColorMode(PrintAttributes.COLOR_MODE_COLOR).build());
    }
    @Override public void onBackPressed(){
        if(editing!=null&&nameField!=null){
            try{saveEditor();}catch(Exception ignore){}
            editing=null;nameField=null;
        }home();
    }
}
