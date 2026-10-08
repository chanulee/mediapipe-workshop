import { normalize, fromPreset, sentence } from './model.mjs';

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const token=()=>crypto.randomUUID()+crypto.randomUUID();
const auth=req=>req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
async function body(req) {
  if(+(req.headers.get('Content-Length')||0)>32000) fail('내용이 너무 커요.',413);
  const text=await req.text();if(text.length>32000)fail('내용이 너무 커요.',413);
  try{const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))fail('내용을 읽지 못했어요.');return value;}catch{fail('내용을 읽지 못했어요.');}
}
const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const projectOf=value=>{try{return normalize(value);}catch(error){fail(error.message);}};
export async function api(req,env) {
  try {
    if(!env.DB)fail('수업 저장소가 아직 준비되지 않았어요.',503);
    const url=new URL(req.url),parts=url.pathname.split('/').filter(Boolean),method=req.method;
    if(!['GET','HEAD'].includes(method) && req.headers.get('Origin') && req.headers.get('Origin')!==url.origin)fail('같은 수업 페이지에서 다시 시도해주세요.',403);
    const one=(sql,...args)=>env.DB.prepare(sql).bind(...args).first();
    const run=(sql,...args)=>env.DB.prepare(sql).bind(...args).run();
    if(parts[1]==='rooms' && parts.length===2 && method==='POST') {
      const b=await body(req),title=clean(b.title,60)||'우리 반 몸 놀이';
      const id=crypto.randomUUID(),secret=token();
      await run('INSERT INTO studio_rooms VALUES (?,?,?,?)',id,title,await hash(secret),Date.now());
      return json({id,title,secret},201);
    }
    if(parts[1]!=='rooms' || !parts[2])fail('주소를 확인해주세요.',404);
    const room=await one('SELECT * FROM studio_rooms WHERE id=?',parts[2]);if(!room)fail('수업을 찾지 못했어요. 선생님 링크로 다시 들어와주세요.',404);
    const teacher=!!auth(req) && await hash(auth(req))===room.teacher_hash;
    if(parts.length===3 && method==='GET')return json({id:room.id,title:room.title,teacher});
    if(parts[3]!=='works')fail('주소를 확인해주세요.',404);
    if(parts.length===4 && method==='POST') {
      const b=await body(req),name=clean(b.name,24);if(!name)fail('이름이나 별명을 적어주세요.');
      const count=await one('SELECT COUNT(*) AS n FROM studio_works WHERE room_id=?',room.id);if(count.n>=40)fail('이 수업의 자리가 모두 찼어요. 선생님께 알려주세요.',409);
      const id=crypto.randomUUID(),secret=token();
      await run('INSERT INTO studio_works VALUES (?,?,?,?,?,?,?)',id,room.id,name,await hash(secret),JSON.stringify(fromPreset()),null,Date.now());
      return json({id,name,secret},201);
    }
    if(parts.length===4 && method==='GET') {
      const rows=await env.DB.prepare('SELECT id,name,draft,published,updated_at FROM studio_works WHERE room_id=? ORDER BY updated_at DESC').bind(room.id).all();
      return json({works:rows.results.filter(r=>teacher||r.published).map(r=>{const p=JSON.parse(teacher?r.draft:r.published);return {id:r.id,name:r.name,title:p.title||`${r.name}의 놀이`,toy:p.toy,connections:sentence(p),published:!!r.published,updatedAt:r.updated_at};})});
    }
    const work=await one('SELECT * FROM studio_works WHERE id=? AND room_id=?',parts[4],room.id);if(!work)fail('작품을 찾지 못했어요.',404);
    const owner=!!auth(req) && await hash(auth(req))===work.owner_hash;
    if(parts[5]==='image') {
      if(method==='POST') {
        if(!owner)fail('내 작품에서 그림을 골라주세요.',403);
        const type=req.headers.get('Content-Type');if(!['image/png','image/jpeg','image/webp'].includes(type))fail('PNG, JPG, WebP 그림을 골라주세요.');
        if(!env.BUCKET)fail('그림 저장소를 준비하고 있어요.',503);
        if(+(req.headers.get('Content-Length')||0)>300000)fail('그림을 조금 작게 만들어주세요.',413);
        const bytes=await req.arrayBuffer();if(bytes.byteLength>300000)fail('그림을 조금 작게 만들어주세요.',413);
        const id=crypto.randomUUID();await env.BUCKET.put(`${room.id}/${work.id}/${id}`,bytes,{httpMetadata:{contentType:type}});return json({image:id});
      }
      if(method==='GET') {
        const id=parts[6],draft=JSON.parse(work.draft),published=work.published&&JSON.parse(work.published);
        if(id!==published?.image && !(teacher||owner)&&id===draft.image)fail('아직 공개하지 않은 그림이에요.',403);
        if(id!==draft.image&&id!==published?.image)fail('그림을 찾지 못했어요.',404);
        const asset=await env.BUCKET?.get(`${room.id}/${work.id}/${id}`);if(!asset)fail('그림을 찾지 못했어요.',404);
        return new Response(asset.body,{headers:{'Content-Type':asset.httpMetadata?.contentType||'image/jpeg','Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff'}});
      }
    }
    if(parts[5]==='feedback' && method==='POST') {
      const b=await body(req);let author='선생님';
      if(!teacher) {
        const from=await one('SELECT name,owner_hash FROM studio_works WHERE id=? AND room_id=?',b.from,room.id);
        if(!work.published||!from||await hash(auth(req))!==from.owner_hash)fail('수업에 들어온 뒤 친구 작품에 남겨주세요.',403);
        author=from.name;
      }
      const message=clean(b.message,240);if(!message)fail('한 문장을 적어주세요.');
      await run('INSERT INTO studio_feedback VALUES (?,?,?,?,?)',crypto.randomUUID(),work.id,author,message,Date.now());return json({ok:true});
    }
    if(parts[5]==='publish' && method==='POST') {
      if(!owner)fail('내 작품에서 공개해주세요.',403);
      const b=await body(req);const p=projectOf(b.project);
      if(!p.title||!p.instruction)fail('놀이 이름과 친구에게 알려줄 말을 적어주세요.');
      await run('UPDATE studio_works SET draft=?,published=?,updated_at=? WHERE id=?',JSON.stringify(p),JSON.stringify(p),Date.now(),work.id);return json({ok:true});
    }
    if(parts[5]==='unpublish' && method==='POST') {
      if(!owner&&!teacher)fail('공개를 바꿀 수 없어요.',403);
      await run('UPDATE studio_works SET published=NULL WHERE id=?',work.id);return json({ok:true});
    }
    if(parts.length===5 && method==='PUT') {
      if(!owner)fail('내 작품만 바꿀 수 있어요.',403);
      const p=projectOf((await body(req)).project);
      await run('UPDATE studio_works SET draft=?,updated_at=? WHERE id=?',JSON.stringify(p),Date.now(),work.id);return json({ok:true});
    }
    if(parts.length===5 && method==='GET') {
      if(!teacher&&!owner&&!work.published)fail('아직 만드는 중인 작품이에요.',403);
      const published=url.searchParams.get('published')==='1';
      const project=JSON.parse((published&&work.published)||((teacher||owner)?work.draft:work.published));
      const notes=teacher||owner?(await env.DB.prepare('SELECT author,message,created_at FROM studio_feedback WHERE work_id=? ORDER BY created_at DESC LIMIT 30').bind(work.id).all()).results:[];
      return json({id:work.id,name:work.name,project,feedback:notes,published:!!work.published,owner});
    }
    fail('지원하지 않는 요청이에요.',405);
  }catch(error){if(!error.status)console.error('studio API',error);return json({error:error.status?error.message:'저장이 잠시 어려워요. 화면을 닫지 말고 다시 시도해주세요.'},error.status||500);}
}
