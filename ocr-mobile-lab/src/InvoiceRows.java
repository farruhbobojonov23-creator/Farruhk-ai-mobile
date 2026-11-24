import java.util.*;
/** Experimental layout adapter: preserves spatial coordinates and never guesses missing cells. */
public final class InvoiceRows {
 public record Box(String text,double x0,double y0,double x1,double y1,double confidence) {
  public Box { if(text==null||!Double.isFinite(x0)||!Double.isFinite(y0)||!Double.isFinite(x1)||!Double.isFinite(y1)||x1<=x0||y1<=y0||!Double.isFinite(confidence)||confidence<0||confidence>1)throw new IllegalArgumentException("Invalid OCR box"); }
  double cy(){return (y0+y1)/2;} double height(){return y1-y0;}
 }
 public record Row(List<Box> cells,boolean needsReview){}
 public static List<Row> group(List<Box> boxes){
  List<Box> sorted=new ArrayList<>(boxes);sorted.sort(Comparator.comparingDouble(Box::cy).thenComparingDouble(Box::x0));
  List<List<Box>> groups=new ArrayList<>();
  for(Box b:sorted){
   List<Box> best=null;double distance=Double.MAX_VALUE;
   for(List<Box> g:groups){
    double center=g.stream().mapToDouble(Box::cy).average().orElse(b.cy());
    double height=g.stream().mapToDouble(Box::height).sorted().skip((g.size()-1)/2).findFirst().orElse(b.height());
    double delta=Math.abs(center-b.cy());
    // Cap at half the smaller text height to avoid merging adjacent invoice rows.
    if(delta<=.45*Math.min(height,b.height())&&delta<distance){best=g;distance=delta;}
   }
   if(best==null){best=new ArrayList<>();groups.add(best);}best.add(b);
  }
  List<Row> result=new ArrayList<>();
  for(List<Box> g:groups){g.sort(Comparator.comparingDouble(Box::x0));result.add(new Row(List.copyOf(g),true));}
  return List.copyOf(result);
 }
 /** Boundaries must be determined from verified headers, not hard-coded supplier guesses. */
 public static List<String> columns(Row row,double[] boundaries){
  if(boundaries.length<2)throw new IllegalArgumentException("Need column boundaries");
  for(int i=0;i<boundaries.length;i++)if(!Double.isFinite(boundaries[i])||(i>0&&boundaries[i]<=boundaries[i-1]))throw new IllegalArgumentException("Invalid boundaries");
  List<List<String>> cells=new ArrayList<>();for(int i=1;i<boundaries.length;i++)cells.add(new ArrayList<>());
  for(Box b:row.cells()){
   int col=-1;for(int i=0;i<cells.size();i++)if(b.x0()>=boundaries[i]&&b.x1()<=boundaries[i+1]){col=i;break;}
   if(col<0)throw new IllegalArgumentException("Ambiguous box across columns: "+b.text());
   cells.get(col).add(b.text());
  }
  return cells.stream().map(x->String.join(" ",x)).toList();
 }
}
