import java.io.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.Base64;

class SignWeb {
 public static void main(String[] args)throws Exception{
  if(args.length!=6)throw new IllegalArgumentException("key alias payload output cert revision");
  char[] password=System.getenv("STORE_PASS").toCharArray();
  char[] keypass=System.getenv("KEY_PASS").toCharArray();
  KeyStore ks=KeyStore.getInstance(new File(args[0]),password);
  java.security.cert.Certificate cert=ks.getCertificate(args[1]);
  String actual=java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(cert.getEncoded()));
  if(!actual.equalsIgnoreCase(args[4]))throw new SecurityException("Certificate mismatch");
  byte[] payload=Files.readAllBytes(Path.of(args[2]));
  Signature sig=Signature.getInstance("SHA256withRSA");sig.initSign((PrivateKey)ks.getKey(args[1],keypass));sig.update(payload);byte[] signature=sig.sign();
  sig.initVerify(cert);sig.update(payload);if(!sig.verify(signature))throw new SecurityException("Verification failed");
  String envelope="{\"payload\":\""+Base64.getEncoder().encodeToString(payload)+"\",\"signature\":\""+Base64.getEncoder().encodeToString(signature)+"\"}";
  Files.writeString(Path.of(args[3]),envelope,StandardCharsets.UTF_8);
  System.out.println("Verified signed web revision "+args[5]+", "+envelope.length()+" bytes");
 }
}
