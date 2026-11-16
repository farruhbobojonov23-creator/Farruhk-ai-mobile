package com.farukh.ttkpro;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Locale;

/**
 * Conservative nutritional calculation and production-readiness review.
 * NEVER labels a document legally compliant merely because a PDF exists.
 * Current Russian catering requirements: SanPiN 2.3/2.4.4282-26,
 * and GOST 31987-2012 requirements for TTK.
 */
public final class RecipeAudit {
    public static final String SANPIN="СанПиН 2.3/2.4.4282-26";
    public static final String GOST="ГОСТ 31987-2012";
    public final ArrayList<String> issues=new ArrayList<>();
    public final LinkedHashSet<String> allergens=new LinkedHashSet<>();
    public final ArrayList<String> missingIngredients=new ArrayList<>();
    public double brutto, netto, kcal, protein, fat, carbohydrates, yield;
    public int items, unverifiedIngredients, unknownAllergens;
    public boolean readyForApproval;
    private RecipeAudit(){}

    public static RecipeAudit inspect(TTKStore store,JSONObject dish){
        RecipeAudit a=new RecipeAudit();
        if(dish==null){a.issues.add("Нет данных блюда");return a;}
        String name=dish.optString("name","").trim();
        if(name.isEmpty()||"Новое блюдо".equals(name)||name.endsWith("· пример"))
            a.issues.add("Укажите утверждаемое наименование блюда");
        if(dish.optString("category","").trim().isEmpty())
            a.issues.add("Не указана категория");
        if(blank(dish,"scope"))a.issues.add("Заполните область применения и предприятие");
        if(blank(dish,"rawRequirements"))a.issues.add("Заполните требования к качеству и безопасности сырья");
        if(blank(dish,"tech")||dish.optString("tech").trim().length()<70)
            a.issues.add("Проверьте технологию, операции и режимы термообработки");
        if(blank(dish,"quality")||blank(dish,"serving"))
            a.issues.add("Заполните качество, оформление и подачу");
        if(blank(dish,"safety"))
            a.issues.add("Укажите показатели безопасности/контроль по производственному плану");
        if(blank(dish,"temp")||dish.optString("temp").toLowerCase(Locale.ROOT).contains("указать"))
            a.issues.add("Установите температуру хранения по техпроцессу");
        if(blank(dish,"storage")||dish.optString("storage").toLowerCase(Locale.ROOT).contains("установить"))
            a.issues.add("Установите обоснованный срок годности");
        if(blank(dish,"author")||blank(dish,"approver"))
            a.issues.add("Требуются разработал и утвердил");
        a.yield=parse(dish.optString("yield",""));
        if(a.yield<=0)a.issues.add("Выход готового блюда должен быть больше нуля");
        JSONArray rows=dish.optJSONArray("rows");
        if(rows==null||rows.length()==0){a.issues.add("Добавьте ингредиенты с массой брутто и нетто");return a;}
        for(int i=0;i<rows.length();i++){
            JSONObject row=rows.optJSONObject(i);if(row==null){a.issues.add("Пустая строка рецептуры "+(i+1));continue;}
            String nm=row.optString("name","").trim();
            double b=row.optDouble("brutto",-1),n=row.optDouble("netto",-1);
            a.items++;a.brutto+=Math.max(0,b);a.netto+=Math.max(0,n);
            if(nm.isEmpty()||!Double.isFinite(n)||n<=0||!Double.isFinite(b)||b<0)
                a.issues.add("Проверьте массу и название строки "+(i+1));
            if(n>b+0.0001)a.issues.add("Нетто больше брутто: "+nm+" (проверьте учёт ПФ)");
            JSONObject ing=store.findIngredient(nm);
            if(ing==null){
                a.missingIngredients.add(nm);
                a.unknownAllergens++;
                continue;
            }
            a.kcal+=n*ing.optDouble("kcal",0)/100d;
            a.protein+=n*ing.optDouble("p",0)/100d;
            a.fat+=n*ing.optDouble("f",0)/100d;
            a.carbohydrates+=n*ing.optDouble("c",0)/100d;
            String list=ing.optString("allergen","").trim();
            if(!list.isEmpty()){
                for(String token:list.split("[;,]")){
                    String item=token.trim();
                    if(!item.isEmpty())a.allergens.add(item);
                }
            }
            if(!ing.optBoolean("nutritionVerified",false))a.unverifiedIngredients++;
            if(!ing.optBoolean("allergensVerified",false))a.unknownAllergens++;
        }
        if(a.yield>0&&Math.abs(a.netto-a.yield)>Math.max(3,a.yield*.02))
            a.issues.add("Сумма нетто ("+num(a.netto)+" г) не совпадает с выходом ("+num(a.yield)+" г); уточните потери/добавки");
        if(!a.missingIngredients.isEmpty())
            a.issues.add("Нет справочных данных: "+String.join(", ",a.missingIngredients));
        if(a.unverifiedIngredients>0)
            a.issues.add("Пищевая ценность не подтверждена для "+a.unverifiedIngredients+" ингредиентов");
        if(a.unknownAllergens>0)
            a.issues.add("Аллергены не подтверждены для "+a.unknownAllergens+" ингредиентов");
        a.readyForApproval=a.issues.isEmpty();
        return a;
    }
    private static boolean blank(JSONObject o,String key){
        String s=o.optString(key,"").trim();
        return s.isEmpty()||s.equals("—");
    }
    private static double parse(String s){
        try{return Double.parseDouble(s.replace(',','.'));}catch(Exception e){return 0;}
    }
    public double kcal100(){return yield>0?kcal*100d/yield:0;}
    public double protein100(){return yield>0?protein*100d/yield:0;}
    public double fat100(){return yield>0?fat*100d/yield:0;}
    public double carbohydrates100(){return yield>0?carbohydrates*100d/yield:0;}
    public static String num(double x){return String.format(Locale.US,"%.1f",x).replace('.',',');}
    public String summary(){
        if(issues.isEmpty())return "Поля заполнены. Перед использованием подтвердите документ у руководителя.";
        return "ТТК — черновик. Найдено замечаний: "+issues.size()+"\n\n• "+String.join("\n• ",issues);
    }
}
