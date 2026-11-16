package com.farukh.ttkpro;

import android.content.Context;
import android.graphics.pdf.PdfRenderer;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

public final class SmokeCheck {
    private SmokeCheck(){}
    public static void run(Context ctx,TTKStore store){
        StringBuilder result=new StringBuilder();
        File folder=ctx.getExternalFilesDir(null);
        int checks=0,failed=0;
        try{
            if(folder==null)throw new Exception("Cannot write to external test folder");
            if(store.categories().size()<12)throw new Exception("Missing category records");
            result.append("PASS: categories=12+\n");checks++;
            if(store.ingredients().size()<25)throw new Exception("Missing initial ingredient records");
            result.append("PASS: ingredient catalog\n");checks++;
            if(store.dishes().isEmpty())throw new Exception("Missing example TTK");
            JSONObject original=store.dishes().get(0);
            if(!"farukh-ttk-pro-backup-v1".equals(store.backup().getString("format")))throw new Exception("Backup serialization error");
            result.append("PASS: JSON backup serialization\n");checks++;
            // Verify that nutrient arithmetic is per recipe/100g, not blindly per 100g raw weight.
            RecipeAudit audit=RecipeAudit.inspect(store,original);
            if(audit.netto<=0||audit.kcal<=0||audit.yield<=0)throw new Exception("Nutritional results unexpectedly blank");
            double expected=audit.kcal*100d/audit.yield;
            if(Math.abs(expected-audit.kcal100())>0.00001)throw new Exception("KБЖУ per-100g formula failure");
            result.append("PASS: nutrition per dish and per 100g; sample kcal=").append(RecipeAudit.num(audit.kcal)).append("\\n");checks++;
            if(audit.issues.isEmpty())throw new Exception("Unverified sample must not be marked compliant");
            if(audit.unknownAllergens<1)throw new Exception("Unverified allergens not flagged");
            result.append("PASS: unverified allergens and ingredients flagged\\n");checks++;
            JSONObject modified=new JSONObject(original.toString());
            JSONArray wrong=new JSONArray();
            wrong.put(TTKStore.row("Рис для суши готовый",2,5));
            modified.put("rows",wrong);
            RecipeAudit bad=RecipeAudit.inspect(store,modified);
            if(!bad.summary().contains("Нетто больше брутто"))throw new Exception("Brutto/netto consistency check failed");
            result.append("PASS: brutto vs netto check\\n");checks++;
            if(!TTKStore.defaultTechnology("Запечённые роллы").contains("термическую")
              ||!TTKStore.defaultTechnology("Темпура").contains("Обжар"))
              throw new Exception("Category-specific technologies are not independent");
            result.append("PASS: category-specific cooking technology\\n");checks++;
            for(int t=0;t<4;t++){
                JSONObject dish=new JSONObject(original.toString());dish.put("template",t);
                byte[] data=PdfMaker.generate(ctx,store,dish);
                if(data.length<1500||data[0]!='%'||data[1]!='P'||data[2]!='D'||data[3]!='F')
                    throw new Exception("Invalid PDF header for template "+t);
                File pdf=new File(folder,"farukh-smoke-"+t+".pdf");
                try(FileOutputStream out=new FileOutputStream(pdf)){out.write(data);}
                try(ParcelFileDescriptor fd=ParcelFileDescriptor.open(pdf,ParcelFileDescriptor.MODE_READ_ONLY);
                        PdfRenderer renderer=new PdfRenderer(fd)){
                    if(renderer.getPageCount()!=1)throw new Exception("Template "+t+" is not one A4 page");
                    try(PdfRenderer.Page page=renderer.openPage(0)){
                        if(page.getWidth()!=595||page.getHeight()!=842)throw new Exception("Invalid page size for template "+t);
                    }
                }
                checks++;result.append("PASS: PDF theme ").append(t).append(" one A4 page, ").append(data.length).append(" bytes\n");
            }
            JSONObject big=new JSONObject(original.toString());
            JSONArray many=new JSONArray();
            for(int i=0;i<60;i++)many.put(TTKStore.row("Рис для суши готовый",8,8));
            big.put("rows",many);
            boolean rejected=false;
            try{PdfMaker.generate(ctx,store,big);}
            catch(Exception e){rejected=true;}
            if(!rejected)throw new Exception("Oversized TTK silently truncated; must reject one-page overflow");
            checks++;result.append("PASS: overfull A4 content is rejected\n");
            result.append("RESULT: PASS (").append(checks).append(" checks)\n");
        }catch(Exception e){
            failed++;result.append("RESULT: FAIL ").append(e.toString()).append("\n");
        }finally{
            Log.i("FARUKH_QA",result.toString());
            if(folder!=null){
                try(FileOutputStream out=new FileOutputStream(new File(folder,"farukh-qa-results.txt"))){
                    out.write(result.toString().getBytes(StandardCharsets.UTF_8));
                }catch(Exception e){Log.e("FARUKH_QA","Cannot write results",e);}
            }
        }
    }
}
