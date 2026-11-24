import java.util.*;
public final class InvoiceRowsTest {
 static InvoiceRows.Box box(String s,double x,double y){return new InvoiceRows.Box(s,x,y,x+35,y+12,.96);}
 static void check(boolean b){if(!b)throw new AssertionError();}
 public static void main(String[] args){
  var rows=InvoiceRows.group(List.of(box("100,00",160,21),box("Рис",10,20),box("25",110,22),box("Сыр",10,40),box("600,00",160,41),box("4,9",110,39)));
  check(rows.size()==2);
  check(InvoiceRows.columns(rows.get(0),new double[]{0,100,150,220}).equals(List.of("Рис","25","100,00")));
  check(InvoiceRows.columns(rows.get(1),new double[]{0,100,150,220}).equals(List.of("Сыр","4,9","600,00")));
  check(rows.stream().allMatch(InvoiceRows.Row::needsReview));
  var missing=InvoiceRows.group(List.of(box("Соус",10,20),box("300,00",160,20)));
  check(InvoiceRows.columns(missing.get(0),new double[]{0,100,150,220}).equals(List.of("Соус","","300,00")));
  try{InvoiceRows.columns(rows.get(0),new double[]{0,120,220});throw new AssertionError("crossing box accepted");}catch(IllegalArgumentException expected){}
  System.out.println("PASS: row separation, spatial ordering, missing cells, crossing boxes, mandatory review");
 }
}
