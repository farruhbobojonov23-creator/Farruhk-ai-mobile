const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inline=text=>escape(text).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
export function formatChat(text){
 const lines=String(text).split('\n'),out=[];let list='';
 const close=()=>{if(list){out.push('</'+list+'>');list=''}};
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(line.includes('|')&&i+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){
   close();const cells=s=>s.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>inline(x.trim()));
   out.push('<div class="chat-table"><table><thead><tr>'+cells(line).map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>');i++;
   while(i+1<lines.length&&lines[i+1].includes('|'))out.push('<tr>'+cells(lines[++i]).map(x=>'<td>'+x+'</td>').join('')+'</tr>');out.push('</tbody></table></div>');continue;
  }
  const bullet=line.match(/^\s*([-*]|\d+[.)])\s+(.+)$/);
  if(bullet){const type=/\d/.test(bullet[1])?'ol':'ul';if(type!==list){close();out.push('<'+type+'>');list=type}out.push('<li>'+inline(bullet[2])+'</li>');continue}
  close();if(/^#{1,4}\s/.test(line))out.push('<h3>'+inline(line.replace(/^#{1,4}\s+/,''))+'</h3>');else if(line.trim())out.push('<p>'+inline(line)+'</p>');
 }close();return out.join('');
}
