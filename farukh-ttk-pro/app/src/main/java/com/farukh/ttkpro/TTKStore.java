package com.farukh.ttkpro;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Locale;

public class TTKStore {
    public static final String[] DEFAULT_CATEGORIES={
        "Холодные роллы","Запечённые роллы","Темпура","Маки",
        "Суши","Гунканы","Онигири","Воки","Бери-доги",
        "Закуски","Наборы (сеты)","Полуфабрикаты"
    };
    public static final String[] ICONS={"🍣","🔥","🍤","🍙","🍣","🐟","🍙","🍜","🌭","🥢","🍱","🥣"};
    public static final String[] TEMPLATE_NAMES={"Japanese Pro","Sakura White","Fuji Indigo","Red Zen"};
    private final SharedPreferences prefs;
    private final ArrayList<JSONObject> categories=new ArrayList<>(),ingredients=new ArrayList<>(),dishes=new ArrayList<>();
    TTKStore(Context ctx){
        prefs=ctx.getSharedPreferences("farukh_ttk_pro_v3",Context.MODE_PRIVATE);
        load();
    }
    private JSONObject category(String title,String icon){
        JSONObject o=new JSONObject();
        try{o.put("name",title);o.put("icon",icon);o.put("photo","");}catch(Exception ignore){}
        return o;
    }
    public static JSONObject ingredient(String name,double kcal,double p,double f,double c,String allergen){
        JSONObject o=new JSONObject();
        try{
            o.put("name",name);o.put("kcal",kcal);o.put("p",p);o.put("f",f);o.put("c",c);
            o.put("allergen",allergen);
            o.put("nutritionVerified",false);o.put("allergensVerified",false);
            o.put("source","Демонстрационный справочник: сверить этикетку производителя");
        }catch(Exception ignore){}return o;
    }
    public static JSONObject row(String name,double brutto,double netto){
        JSONObject o=new JSONObject();
        try{o.put("name",name);o.put("brutto",brutto);o.put("netto",netto);}catch(Exception ignore){}
        return o;
    }
    public JSONObject newDish(String cat){
        JSONObject o=new JSONObject();
        try{
            o.put("id",String.valueOf(System.currentTimeMillis()));
            o.put("name","Новое блюдо");o.put("category",cat);
            o.put("yield","260");o.put("pieces","8");o.put("photo","");
            o.put("storage","Установить после проверки рецептуры и условий производства");
            o.put("temp","Указать обоснованный температурный режим");
            o.put("quality","Аккуратная форма, характерные вкус, цвет и запах, без посторонних включений.");
            o.put("serving","Оформить и подать согласно стандарту предприятия.");
            o.put("scope","");
            o.put("rawRequirements","Сырьё и полуфабрикаты должны соответствовать действующим требованиям и иметь документы, подтверждающие качество и безопасность.");
            o.put("safety","Органолептический контроль; микробиологические показатели по применимым требованиям и программе производственного контроля.");
            o.put("approved",false);
            o.put("author","");o.put("approver","");o.put("date","");
            o.put("template",0);o.put("rows",new JSONArray());
            o.put("tech",defaultTechnology(cat));
        }catch(Exception ignore){}
        return o;
    }
    public static String defaultTechnology(String cat){
        if(cat.contains("Запеч"))return "Проверить качество и подготовить сырьё. Сварить и заправить рис по технологической инструкции. Сформовать ролл, подготовить и нанести запекаемую шапку. Провести термическую обработку по подтверждённому режиму до достижения безопасной температуры внутри продукта. Оформить, проверить выход и передать на реализацию.";
        if(cat.contains("Темпура"))return "Подготовить сырьё. Сформовать ролл, приготовить кляр и панировку по рецептуре. Обжарить при установленном технологическом режиме, проконтролировать готовность, удалить излишки масла, порционировать и подать.";
        if(cat.contains("Воки"))return "Подготовить и нарезать компоненты. Провести термическую обработку ингредиентов в установленной последовательности, добавить соус, довести до готовности. Проверить качество и массу порции, оформить подачу.";
        if(cat.contains("Суши"))return "Подготовить заправленный рис и начинку. Сформовать изделие установленной массы, соблюдая санитарные требования и температурные условия. Проверить качество, оформить и подать.";
        return "Подготовить ингредиенты согласно рецептуре. Приготовить и заправить рис, охладить в соответствии с технологией. Равномерно распределить рис по нори, выложить начинку, сформовать ролл при помощи макису. Нарезать на порции, оформить и проверить выход.";
    }
    private void loadList(String key,ArrayList<JSONObject> dest){
        try{JSONArray a=new JSONArray(prefs.getString(key,"[]"));
            for(int i=0;i<a.length();i++)dest.add(a.getJSONObject(i));
        }catch(Exception ignore){}
    }
    private void load(){
        loadList("categories",categories);loadList("ingredients",ingredients);loadList("dishes",dishes);
        if(categories.isEmpty())for(int i=0;i<DEFAULT_CATEGORIES.length;i++)categories.add(category(DEFAULT_CATEGORIES[i],ICONS[i]));
        // Upgrade existing installations without dropping user changes. The default
        // photo key is separate from the editable title and remains stable on rename.
        for(int i=0;i<categories.size();i++){
            JSONObject c=categories.get(i);
            if(!c.has("asset")){
                try{
                    String oldName=c.optString("name","");
                    String asset=i<DEFAULT_CATEGORIES.length && oldName.equals(DEFAULT_CATEGORIES[i])
                        ? FoodPhotos.categoryAsset(DEFAULT_CATEGORIES[i])
                        : FoodPhotos.categoryAsset(oldName);
                    c.put("asset",asset);
                }catch(Exception ignore){}
            }
        }
        if(ingredients.isEmpty()){
            ingredients.add(ingredient("Рис для суши готовый",130,2.8,0.3,28.2,""));
            ingredients.add(ingredient("Нори",350,35,5,30,""));
            ingredients.add(ingredient("Лосось (форель)",208,20,13,0,"Рыба"));
            ingredients.add(ingredient("Сыр сливочный",250,6,24,4,"Молоко"));
            ingredients.add(ingredient("Огурец свежий",15,0.7,0.1,3.1,""));
            ingredients.add(ingredient("Угорь",184,18,11,0,"Рыба"));
            ingredients.add(ingredient("Креветка",85,20,1,0,"Ракообразные"));
            ingredients.add(ingredient("Авокадо",160,2,15,9,""));
            ingredients.add(ingredient("Краб сурими",95,7,1,15,"Рыба, пшеница — проверить состав"));
            ingredients.add(ingredient("Омлет",155,11,11,1,"Яйцо, молоко"));
            ingredients.add(ingredient("Соус спайси",380,2,39,6,"Яйцо, соя — проверить рецептуру"));
            ingredients.add(ingredient("Соус унаги",170,2,0.1,40,"Соя, пшеница — проверить упаковку"));
            ingredients.add(ingredient("Соус терияки",90,4,0,19,"Соя, пшеница — проверить упаковку"));
            ingredients.add(ingredient("Масаго",140,15,6,4,"Рыба"));
            ingredients.add(ingredient("Тобико",140,15,6,4,"Рыба"));
            ingredients.add(ingredient("Кунжут",573,18,50,23,"Кунжут"));
            ingredients.add(ingredient("Курица",165,31,3.6,0,""));
            ingredients.add(ingredient("Лапша удон",124,3.1,0.3,25,"Пшеница"));
            ingredients.add(ingredient("Рисовая лапша",109,0.9,0.2,25,""));
            ingredients.add(ingredient("Морковь",41,0.9,0.2,10,""));
            ingredients.add(ingredient("Капуста",25,1.3,0.1,6,""));
            ingredients.add(ingredient("Болгарский перец",27,1,0.2,6,""));
            ingredients.add(ingredient("Лук зелёный",32,1.8,0.2,7,""));
            ingredients.add(ingredient("Майонез",627,3,67,3,"Яйцо, горчица — проверить упаковку"));
            ingredients.add(ingredient("Сливки",206,2.8,20,3.7,"Молоко"));
            ingredients.add(ingredient("Пармезан",431,38,29,4,"Молоко"));
            ingredients.add(ingredient("Моцарелла",280,28,17,3,"Молоко"));
            ingredients.add(ingredient("Такуан",30,1,0,6,""));
            ingredients.add(ingredient("Чука",90,1.5,3,14,"Кунжут — проверить упаковку"));
            ingredients.add(ingredient("Кимчи соус",90,2,2,15,"Соя, пшеница — проверить упаковку"));
            save();
        }
        // Correct only the known inaccurate demo nori allergen from V0.4/V0.5;
        // never overwrite a user's own verified manufacturer information.
        for(JSONObject ingredient:ingredients){
            if("Нори".equals(ingredient.optString("name"))
               && !ingredient.optBoolean("allergensVerified",false)
               && "Рыба/морепродукты — проверить упаковку".equals(ingredient.optString("allergen"))){
                try{ingredient.put("allergen","");}catch(Exception ignore){}
            }
        }
        save();
        if(dishes.isEmpty()){
            JSONObject sample=newDish("Холодные роллы");
            try{
                sample.put("name","Филадельфия · пример");
                sample.put("yield","260");
                JSONArray r=new JSONArray();
                r.put(row("Рис для суши готовый",120,120));
                r.put(row("Нори",3,3));
                r.put(row("Лосось (форель)",85,80));
                r.put(row("Сыр сливочный",50,50));
                r.put(row("Огурец свежий",8,7));
                sample.put("rows",r);
            }catch(Exception ignore){}
            dishes.add(sample);save();
        }
    }
    public ArrayList<JSONObject> categories(){return categories;}
    public ArrayList<JSONObject> ingredients(){return ingredients;}
    public ArrayList<JSONObject> dishes(){return dishes;}
    public JSONObject findIngredient(String name){
        for(JSONObject o:ingredients)if(o.optString("name").equalsIgnoreCase(name))return o;
        return null;
    }
    public JSONObject backup(){
        JSONObject o=new JSONObject();
        try{
            o.put("format","farukh-ttk-pro-backup-v1");
            o.put("categories",new JSONArray(categories));
            o.put("ingredients",new JSONArray(ingredients));
            o.put("dishes",new JSONArray(dishes));
        }catch(Exception e){throw new IllegalStateException("Failed to build backup",e);}
        return o;
    }
    public void restore(String json) throws Exception{
        JSONObject backup=new JSONObject(json);
        if(!"farukh-ttk-pro-backup-v1".equals(backup.optString("format")))
            throw new IllegalArgumentException("Неверный формат резервной копии");
        JSONArray cats=backup.getJSONArray("categories");
        JSONArray ing=backup.getJSONArray("ingredients");
        JSONArray cards=backup.getJSONArray("dishes");
        if(cats.length()==0 || cats.length()>300 || ing.length()>3000 || cards.length()>10000)
            throw new IllegalArgumentException("Неверное количество записей в резервной копии");
        for(int i=0;i<cats.length();i++)cats.getJSONObject(i);
        for(int i=0;i<ing.length();i++)ing.getJSONObject(i);
        for(int i=0;i<cards.length();i++)cards.getJSONObject(i);
        // Replace all lists only once validation of every entry has passed.
        categories.clear();ingredients.clear();dishes.clear();
        for(int i=0;i<cats.length();i++)categories.add(cats.getJSONObject(i));
        for(int i=0;i<ing.length();i++)ingredients.add(ing.getJSONObject(i));
        for(int i=0;i<cards.length();i++)dishes.add(cards.getJSONObject(i));
        save();
    }
    public void save(){
        prefs.edit().putString("categories",new JSONArray(categories).toString())
          .putString("ingredients",new JSONArray(ingredients).toString())
          .putString("dishes",new JSONArray(dishes).toString()).apply();
    }
    public String pretty(double val){return String.format(Locale.US,"%.1f",val).replace('.',',');}
}
