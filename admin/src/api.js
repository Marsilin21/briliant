let csrf='';
export const setCsrf=value=>{csrf=value;};
export async function api(path,method='GET',body){
 const multipart=body instanceof FormData;
 const response=await fetch('/api'+path,{method,credentials:'same-origin',headers:{...(body&&!multipart?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-CSRF-Token':csrf}:{})},body:body?(multipart?body:JSON.stringify(body)):undefined});
 const result=await response.json();if(!response.ok){const error=new Error(result.error||'Не удалось выполнить запрос');error.status=response.status;throw error;}return result;
}
