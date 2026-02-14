(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const d of document.querySelectorAll('link[rel="modulepreload"]'))n(d);new MutationObserver(d=>{for(const i of d)if(i.type==="childList")for(const c of i.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&n(c)}).observe(document,{childList:!0,subtree:!0});function o(d){const i={};return d.integrity&&(i.integrity=d.integrity),d.referrerPolicy&&(i.referrerPolicy=d.referrerPolicy),d.crossOrigin==="use-credentials"?i.credentials="include":d.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function n(d){if(d.ep)return;d.ep=!0;const i=o(d);fetch(d.href,i)}})();function T(){return new Date().toISOString().slice(0,10)}function C(t=new Date){const e=new Date(t),o=e.getDay(),n=o===0?-6:1-o,d=new Date(e);d.setDate(e.getDate()+n);const i=new Date(d);return i.setDate(d.getDate()+6),{fromISO:d.toISOString().slice(0,10),toISO:i.toISOString().slice(0,10)}}const k=C(),a={user:null,loading:!1,error:"",activeTab:"dia",selectedUnidade:"",selectedDate:T(),weekFrom:k.fromISO,weekTo:k.toISO,unidades:[],profissionais:[],dayData:{entradas:{dinheiro:0,pix:0,debito:0,credito:0,outros:0},obs:"",saidas:[],profissionais:[]},consolidated:null,payments:[],messages:{dia:"",semana:"",pagamentos:""}};function v(t){Object.assign(a,t)}function E(t){a.error=t||""}async function F(){const t=window.netlifyIdentity,e=t==null?void 0:t.currentUser();if(!e)throw new Error("Usuário não autenticado.");return e.jwt()}async function g(t,e={}){const o=await F(),n=await fetch("/api",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${o}`},body:JSON.stringify({action:t,...e})}),d=await n.text();let i=null;try{i=d?JSON.parse(d):{}}catch{throw new Error(`Resposta inválida da API (${n.status}).`)}if(!n.ok)throw new Error(i.error||`Falha na API (${n.status})`);return i}function A(t,e){return g("getDay",{unidade_id:t,dataISO:e})}function U(t){return g("upsertDay",t)}function O(t,e,o){return g("getConsolidated",{unidade_id:t,fromISO:e,toISO:o})}function X(t){return g("upsertPayments",t)}function N({unidade_id:t="",onlyActive:e=!1}={}){return g("cadList",{unidade_id:t,onlyActive:e})}function q(t){return g("cadUpsertUnit",t)}function j(t){return g("cadUpsertProf",t)}const M=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:2});function r(t){return M.format(Number(t||0))}function s(t){const e=Number(t||0);return Number.isFinite(e)?e:0}let D;function S(t){return a.unidades.map(e=>`<option value="${e.id}" ${e.id===t?"selected":""}>${e.nome}</option>`).join("")}function R(t){return["Rascunho","Aguardando aprova��o","Aprovado","Pago"].map(o=>`<option value="${o}" ${o===t?"selected":""}>${o}</option>`).join("")}function W(){return a.profissionais.filter(t=>t.unidade_id===a.selectedUnidade&&String(t.ativo)==="true")}function b(){const t=new Map((a.dayData.profissionais||[]).map(e=>[e.prof_id,e]));a.dayData.profissionais=W().map(e=>{const o=t.get(e.id),n=s(o==null?void 0:o.faturado),d=s(o==null?void 0:o.vales),i=s(o==null?void 0:o.descontos),c=s((o==null?void 0:o.pct)??e.pct),l=n*c,f=l-d-i;return{prof_id:e.id,nome:e.nome,pct:c,faturado:n,vales:d,descontos:i,comissao:l,saldo:f}})}function x(){const t=a.dayData.entradas;return s(t.dinheiro)+s(t.pix)+s(t.debito)+s(t.credito)+s(t.outros)}function L(){return(a.dayData.profissionais||[]).reduce((t,e)=>t+s(e.faturado),0)}function z(){var n;const t=a.dayData.entradas,e=(a.dayData.saidas||[]).reduce((d,i)=>d+s(i.valor),0),o=[];return o.push(`*Resumo do Dia* ${a.selectedDate}`),o.push(`Unidade: ${((n=a.unidades.find(d=>d.id===a.selectedUnidade))==null?void 0:n.nome)||a.selectedUnidade}`),o.push(""),o.push(`Entradas: ${r(x())}`),o.push(`- Dinheiro: ${r(t.dinheiro)}`),o.push(`- PIX: ${r(t.pix)}`),o.push(`- D�bito: ${r(t.debito)}`),o.push(`- Cr�dito: ${r(t.credito)}`),o.push(`- Outros: ${r(t.outros)}`),o.push(`Sa�das: ${r(e)}`),o.push(""),o.push("*Profissionais*"),a.dayData.profissionais.forEach(d=>{o.push(`${d.nome}: faturado ${r(d.faturado)} | comiss�o ${r(d.comissao)} | saldo ${r(d.saldo)}`)}),o.join(`
`)}function K(){if(!a.consolidated)return"";const{kpis:t,profissionais:e}=a.consolidated,o=[];return o.push(`*Consolidado ${a.weekFrom} a ${a.weekTo}*`),o.push(`Entradas: ${r(t.totalEntradas)}`),o.push(`Sa�das: ${r(t.totalSaidas)}`),o.push(`Faturado: ${r(t.totalFaturado)}`),o.push(`Comiss�o: ${r(t.totalComissao)}`),o.push(""),o.push("*Profissionais*"),e.forEach(n=>{o.push(`${n.nome}: saldo ${r(n.saldo_a_pagar)}`)}),o.join(`
`)}function V(){const t=["*Aprova��o PIX*"];return a.payments.filter(e=>s(e.pix)>0).forEach(e=>{t.push(`${e.nome} | PIX ${r(e.pix)} | chave: ${e.chave_pix||"n�o informada"}`)}),t.join(`
`)}function _(t){var e;t&&((e=navigator.clipboard)==null||e.writeText(t))}function y(t){return async(...e)=>{try{v({loading:!0}),E(""),u(),await t(...e)}catch(o){E(o.message)}finally{v({loading:!1}),u()}}}async function w(){const t=await N({onlyActive:!1});v({unidades:t.unidades||[],profissionais:t.profissionais||[]}),!a.selectedUnidade&&a.unidades[0]&&(a.selectedUnidade=a.unidades[0].id),b()}async function G(){const t=await A(a.selectedUnidade,a.selectedDate);if(!t.dia){a.dayData={entradas:{dinheiro:0,pix:0,debito:0,credito:0,outros:0},obs:"",saidas:[],profissionais:[]},b();return}a.dayData={entradas:{dinheiro:s(t.dia.dinheiro),pix:s(t.dia.pix),debito:s(t.dia.debito),credito:s(t.dia.credito),outros:s(t.dia.outros)},obs:t.dia.obs||"",saidas:(t.saidas||[]).map(e=>({tipo:e.tipo||"",forma:e.forma||"",valor:s(e.valor),obs:e.obs||""})),profissionais:(t.profissionais||[]).map(e=>{var o;return{prof_id:e.prof_id,nome:((o=a.profissionais.find(n=>n.id===e.prof_id))==null?void 0:o.nome)||e.prof_id,pct:s(e.pct),faturado:s(e.faturado),vales:s(e.vales),descontos:s(e.descontos),comissao:s(e.comissao),saldo:s(e.saldo)}})},b()}async function J(){b(),await U({unidade_id:a.selectedUnidade,dataISO:a.selectedDate,entradas:a.dayData.entradas,obs:a.dayData.obs,saidas:a.dayData.saidas,profissionais:a.dayData.profissionais})}async function H(){a.consolidated=await O(a.selectedUnidade,a.weekFrom,a.weekTo),a.payments=[],a.paymentsKey=""}function Q(){if(!a.consolidated)return;const t=`${a.selectedUnidade}|${a.weekFrom}|${a.weekTo}`;a.paymentsKey!==t&&(a.payments=a.consolidated.profissionais.map(e=>({prof_id:e.prof_id,nome:e.nome,chave_pix:e.chave_pix||"",saldo_a_pagar:s(e.saldo_a_pagar),a_vista:0,pix:Math.max(0,s(e.saldo_a_pagar)),status:"Rascunho"})),a.paymentsKey=t)}async function Y(){await X({unidade_id:a.selectedUnidade,semanaInicioISO:a.weekFrom,semanaFimISO:a.weekTo,pagamentos:a.payments})}function Z(){if(!a.consolidated||!window.XLSX)return;const t=window.XLSX.utils.book_new(),e=[["Per�odo",`${a.weekFrom} a ${a.weekTo}`],["Total Entradas",a.consolidated.kpis.totalEntradas],["Total Sa�das",a.consolidated.kpis.totalSaidas],["Total Faturado",a.consolidated.kpis.totalFaturado],["Total Comiss�o",a.consolidated.kpis.totalComissao]],o=[["Profissional","Faturado","Comiss�o","Vales","Descontos","Saldo a Pagar"],...a.consolidated.profissionais.map(d=>[d.nome,d.faturado,d.comissao,d.vales,d.descontos,d.saldo_a_pagar])],n=[["Data","Dinheiro","PIX","D�bito","Cr�dito","Outros","Total Entradas","Total Sa�das","Total Faturado"],...a.consolidated.detalheDiario.map(d=>[d.dataISO,d.dinheiro,d.pix,d.debito,d.credito,d.outros,d.totalEntradas,d.totalSaidas,d.totalFaturado])];window.XLSX.utils.book_append_sheet(t,window.XLSX.utils.aoa_to_sheet(e),"Resumo"),window.XLSX.utils.book_append_sheet(t,window.XLSX.utils.aoa_to_sheet(o),"Profissionais"),window.XLSX.utils.book_append_sheet(t,window.XLSX.utils.aoa_to_sheet(n),"Detalhe Di�rio"),window.XLSX.writeFile(t,`consolidado_${a.weekFrom}_${a.weekTo}.xlsx`)}function tt(){return`
    <div class="tabs">
      ${[{id:"dia",label:"Dia"},{id:"consolidado",label:"Consolidado"},{id:"pagamentos",label:"Pagamentos"},{id:"cadastros",label:"Cadastros"}].map(e=>`<button class="tab ${a.activeTab===e.id?"active":""}" data-tab="${e.id}">${e.label}</button>`).join("")}
    </div>
  `}function at(){b();const t=Math.abs(x()-L())>.009;return`
    <section class="card">
      <h2>Dia</h2>
      <div class="grid cols-3">
        <label>Unidade<select id="dia-unidade">${S(a.selectedUnidade)}</select></label>
        <label>Data<input type="date" id="dia-data" value="${a.selectedDate}" /></label>
        <label>Observa��o<textarea id="dia-obs">${a.dayData.obs||""}</textarea></label>
      </div>

      <h3>Entradas</h3>
      <div class="grid cols-5">
        <label>Dinheiro<input type="number" step="0.01" class="entrada" data-field="dinheiro" value="${s(a.dayData.entradas.dinheiro)}" /></label>
        <label>PIX<input type="number" step="0.01" class="entrada" data-field="pix" value="${s(a.dayData.entradas.pix)}" /></label>
        <label>D�bito<input type="number" step="0.01" class="entrada" data-field="debito" value="${s(a.dayData.entradas.debito)}" /></label>
        <label>Cr�dito<input type="number" step="0.01" class="entrada" data-field="credito" value="${s(a.dayData.entradas.credito)}" /></label>
        <label>Outros<input type="number" step="0.01" class="entrada" data-field="outros" value="${s(a.dayData.entradas.outros)}" /></label>
      </div>

      <h3>Sa�das</h3>
      <table>
        <thead><tr><th>Tipo</th><th>Forma</th><th>Valor</th><th>Obs</th><th></th></tr></thead>
        <tbody>
          ${a.dayData.saidas.map((e,o)=>`
                <tr>
                  <td><input class="saida-input" data-idx="${o}" data-field="tipo" value="${e.tipo||""}" /></td>
                  <td><input class="saida-input" data-idx="${o}" data-field="forma" value="${e.forma||""}" /></td>
                  <td><input type="number" step="0.01" class="saida-input" data-idx="${o}" data-field="valor" value="${s(e.valor)}" /></td>
                  <td><input class="saida-input" data-idx="${o}" data-field="obs" value="${e.obs||""}" /></td>
                  <td><button data-remove-saida="${o}">Remover</button></td>
                </tr>
              `).join("")}
        </tbody>
      </table>
      <button id="add-saida">Adicionar sa�da</button>

      <h3>Profissionais</h3>
      <table>
        <thead><tr><th>Profissional</th><th>% Comiss�o</th><th>Faturado</th><th>Vales</th><th>Descontos</th><th>Comiss�o</th><th>Saldo</th></tr></thead>
        <tbody>
          ${a.dayData.profissionais.map(e=>`
              <tr>
                <td>${e.nome}</td>
                <td>${(s(e.pct)*100).toFixed(2)}%</td>
                <td><input type="number" step="0.01" class="prof-input" data-prof="${e.prof_id}" data-field="faturado" value="${s(e.faturado)}" /></td>
                <td><input type="number" step="0.01" class="prof-input" data-prof="${e.prof_id}" data-field="vales" value="${s(e.vales)}" /></td>
                <td><input type="number" step="0.01" class="prof-input" data-prof="${e.prof_id}" data-field="descontos" value="${s(e.descontos)}" /></td>
                <td>${r(e.comissao)}</td>
                <td>${r(e.saldo)}</td>
              </tr>
            `).join("")}
        </tbody>
      </table>

      <div class="totals">
        <span>Total Entradas: ${r(x())}</span>
        <span>Total Faturado: ${r(L())}</span>
        ${t?'<span class="badge">Aviso: Entradas diferente do faturado</span>':""}
      </div>

      <div class="actions">
        <button id="btn-carregar-dia">Carregar Dia</button>
        <button id="btn-salvar-dia">Salvar Dia</button>
        <button id="btn-whats-dia">Gerar WhatsApp (Dia)</button>
      </div>

      <textarea id="msg-dia" rows="6" placeholder="Mensagem do dia">${a.messages.dia||""}</textarea>
      <button id="copy-dia">Copiar</button>
    </section>
  `}function et(){const t=a.consolidated;return`
    <section class="card">
      <h2>Consolidado</h2>
      <div class="grid cols-3">
        <label>Unidade<select id="cons-unidade">${S(a.selectedUnidade)}</select></label>
        <label>De<input type="date" id="cons-from" value="${a.weekFrom}" /></label>
        <label>At�<input type="date" id="cons-to" value="${a.weekTo}" /></label>
      </div>

      <div class="actions">
        <button id="btn-carregar-cons">Atualizar Consolidado</button>
        <button id="btn-whats-semana">Gerar WhatsApp (Semana)</button>
        <button id="btn-export-xlsx">Exportar Excel</button>
      </div>

      ${t?`
        <div class="kpis">
          <div>Entradas: ${r(t.kpis.totalEntradas)}</div>
          <div>Sa�das: ${r(t.kpis.totalSaidas)}</div>
          <div>Faturado: ${r(t.kpis.totalFaturado)}</div>
          <div>Comiss�o: ${r(t.kpis.totalComissao)}</div>
        </div>
        <table>
          <thead><tr><th>Profissional</th><th>Faturado</th><th>Comiss�o</th><th>Vales</th><th>Descontos</th><th>Saldo a pagar</th></tr></thead>
          <tbody>
            ${t.profissionais.map(e=>`
                <tr>
                  <td>${e.nome}</td>
                  <td>${r(e.faturado)}</td>
                  <td>${r(e.comissao)}</td>
                  <td>${r(e.vales)}</td>
                  <td>${r(e.descontos)}</td>
                  <td>${r(e.saldo_a_pagar)}</td>
                </tr>
              `).join("")}
          </tbody>
        </table>
      `:"<p>Carregue o consolidado para visualizar os dados.</p>"}

      <textarea id="msg-semana" rows="6" placeholder="Mensagem da semana">${a.messages.semana||""}</textarea>
      <button id="copy-semana">Copiar</button>
    </section>
  `}function ot(){return Q(),`
    <section class="card">
      <h2>Pagamentos</h2>
      <p>Baseado no consolidado atual (${a.weekFrom} a ${a.weekTo}).</p>

      <table>
        <thead><tr><th>Profissional</th><th>Saldo a pagar</th><th>� vista</th><th>PIX</th><th>Status</th></tr></thead>
        <tbody>
          ${a.payments.map((t,e)=>`
                <tr>
                  <td>${t.nome}</td>
                  <td>${r(t.saldo_a_pagar)}</td>
                  <td><input type="number" step="0.01" class="pay-avista" data-idx="${e}" value="${s(t.a_vista)}" /></td>
                  <td><input type="number" step="0.01" class="pay-pix" data-idx="${e}" value="${s(t.pix)}" /></td>
                  <td><select class="pay-status" data-idx="${e}">${R(t.status)}</select></td>
                </tr>
              `).join("")}
        </tbody>
      </table>

      <div class="actions">
        <button id="btn-msg-pix">Gerar mensagem Aprova��o PIX</button>
        <button id="btn-salvar-pag">Salvar Pagamentos</button>
      </div>

      <textarea id="msg-pag" rows="6">${a.messages.pagamentos||""}</textarea>
      <button id="copy-pag">Copiar</button>
    </section>
  `}function dt(){return`
    <section class="card">
      <h2>Cadastros</h2>

      <div class="split">
        <div>
          <h3>Unidades</h3>
          <form id="form-unidade" class="inline-form">
            <input type="hidden" id="unit-id" />
            <input id="unit-nome" placeholder="Nome da unidade" required />
            <label><input type="checkbox" id="unit-ativo" checked /> Ativo</label>
            <button type="submit">Salvar Unidade</button>
          </form>
          <table>
            <thead><tr><th>Nome</th><th>Ativo</th><th></th></tr></thead>
            <tbody>
              ${a.unidades.map(t=>`
                    <tr>
                      <td>${t.nome}</td>
                      <td>${String(t.ativo)==="true"?"Sim":"N�o"}</td>
                      <td><button data-edit-unit="${t.id}">Editar</button></td>
                    </tr>
                  `).join("")}
            </tbody>
          </table>
        </div>

        <div>
          <h3>Profissionais</h3>
          <form id="form-prof" class="inline-form">
            <input type="hidden" id="prof-id" />
            <select id="prof-unidade" required>${S(a.selectedUnidade)}</select>
            <input id="prof-nome" placeholder="Nome" required />
            <input id="prof-pct" type="number" step="0.01" min="0" max="1" placeholder="Pct (0.5)" required />
            <input id="prof-pix" placeholder="Chave PIX" />
            <label><input type="checkbox" id="prof-ativo" checked /> Ativo</label>
            <button type="submit">Salvar Profissional</button>
          </form>
          <table>
            <thead><tr><th>Nome</th><th>Unidade</th><th>%</th><th>PIX</th><th>Ativo</th><th></th></tr></thead>
            <tbody>
              ${a.profissionais.filter(t=>t.unidade_id===a.selectedUnidade).map(t=>{var e;return`
                    <tr>
                      <td>${t.nome}</td>
                      <td>${((e=a.unidades.find(o=>o.id===t.unidade_id))==null?void 0:e.nome)||t.unidade_id}</td>
                      <td>${(s(t.pct)*100).toFixed(2)}%</td>
                      <td>${t.chave_pix||"-"}</td>
                      <td>${String(t.ativo)==="true"?"Sim":"N�o"}</td>
                      <td><button data-edit-prof="${t.id}">Editar</button></td>
                    </tr>
                  `}).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `}function nt(){return`
    <section class="login-screen">
      <div class="login-card">
        <h1>Comiss�es</h1>
        <p>Fa�a login para acessar o sistema.</p>
        <button id="btn-login">Entrar</button>
      </div>
    </section>
  `}function it(){var t;return`
    <div class="container">
      <header>
        <h1>Comiss�es</h1>
        <div>
          <span>${((t=a.user)==null?void 0:t.email)||""}</span>
          <button id="btn-reload">Atualizar Cadastros</button>
          <button id="btn-logout">Sair</button>
        </div>
      </header>

      ${tt()}

      ${a.error?`<p class="error">${a.error}</p>`:""}
      ${a.loading?'<p class="loading">Carregando...</p>':""}

      <main>
        ${a.activeTab==="dia"?at():""}
        ${a.activeTab==="consolidado"?et():""}
        ${a.activeTab==="pagamentos"?ot():""}
        ${a.activeTab==="cadastros"?dt():""}
      </main>
    </div>
  `}function st(){var t,e,o;(t=document.getElementById("btn-login"))==null||t.addEventListener("click",()=>{var n;return(n=window.netlifyIdentity)==null?void 0:n.open("login")}),(e=document.getElementById("btn-logout"))==null||e.addEventListener("click",()=>{var n;return(n=window.netlifyIdentity)==null?void 0:n.logout()}),(o=document.getElementById("btn-reload"))==null||o.addEventListener("click",y(w)),document.querySelectorAll("[data-tab]").forEach(n=>{n.addEventListener("click",()=>{a.activeTab=n.getAttribute("data-tab"),u()})})}function rt(){var t,e,o,n,d,i,c,l,f;(t=document.getElementById("dia-unidade"))==null||t.addEventListener("change",m=>{a.selectedUnidade=m.target.value,b(),u()}),(e=document.getElementById("dia-data"))==null||e.addEventListener("change",m=>{a.selectedDate=m.target.value}),(o=document.getElementById("dia-obs"))==null||o.addEventListener("input",m=>{a.dayData.obs=m.target.value}),document.querySelectorAll(".entrada").forEach(m=>{m.addEventListener("input",p=>{a.dayData.entradas[p.target.dataset.field]=s(p.target.value),u()})}),(n=document.getElementById("add-saida"))==null||n.addEventListener("click",()=>{a.dayData.saidas.push({tipo:"",forma:"",valor:0,obs:""}),u()}),document.querySelectorAll("[data-remove-saida]").forEach(m=>{m.addEventListener("click",()=>{const p=Number(m.getAttribute("data-remove-saida"));a.dayData.saidas.splice(p,1),u()})}),document.querySelectorAll(".saida-input").forEach(m=>{m.addEventListener("input",p=>{const I=Number(p.target.dataset.idx),$=p.target.dataset.field;a.dayData.saidas[I][$]=$==="valor"?s(p.target.value):p.target.value})}),document.querySelectorAll(".prof-input").forEach(m=>{m.addEventListener("input",p=>{const I=p.target.dataset.prof,$=p.target.dataset.field,h=a.dayData.profissionais.find(P=>P.prof_id===I);h&&(h[$]=s(p.target.value),h.comissao=s(h.faturado)*s(h.pct),h.saldo=h.comissao-s(h.vales)-s(h.descontos),u())})}),(d=document.getElementById("btn-carregar-dia"))==null||d.addEventListener("click",y(G)),(i=document.getElementById("btn-salvar-dia"))==null||i.addEventListener("click",y(J)),(c=document.getElementById("btn-whats-dia"))==null||c.addEventListener("click",()=>{a.messages.dia=z(),u()}),(l=document.getElementById("msg-dia"))==null||l.addEventListener("input",m=>{a.messages.dia=m.target.value}),(f=document.getElementById("copy-dia"))==null||f.addEventListener("click",()=>_(a.messages.dia))}function lt(){var t,e,o,n,d,i,c,l;(t=document.getElementById("cons-unidade"))==null||t.addEventListener("change",f=>{a.selectedUnidade=f.target.value}),(e=document.getElementById("cons-from"))==null||e.addEventListener("change",f=>{a.weekFrom=f.target.value}),(o=document.getElementById("cons-to"))==null||o.addEventListener("change",f=>{a.weekTo=f.target.value}),(n=document.getElementById("btn-carregar-cons"))==null||n.addEventListener("click",y(H)),(d=document.getElementById("btn-whats-semana"))==null||d.addEventListener("click",()=>{a.messages.semana=K(),u()}),(i=document.getElementById("btn-export-xlsx"))==null||i.addEventListener("click",Z),(c=document.getElementById("copy-semana"))==null||c.addEventListener("click",()=>_(a.messages.semana)),(l=document.getElementById("msg-semana"))==null||l.addEventListener("input",f=>{a.messages.semana=f.target.value})}function ct(){var t,e,o,n;document.querySelectorAll(".pay-avista").forEach(d=>{d.addEventListener("input",i=>{const c=Number(i.target.dataset.idx),l=a.payments[c];l&&(l.a_vista=Math.max(0,s(i.target.value)),l.pix=Math.max(0,l.saldo_a_pagar-l.a_vista),u())})}),document.querySelectorAll(".pay-pix").forEach(d=>{d.addEventListener("input",i=>{const c=Number(i.target.dataset.idx),l=a.payments[c];l&&(l.pix=Math.max(0,Math.min(l.saldo_a_pagar,s(i.target.value))),l.a_vista=Math.max(0,l.saldo_a_pagar-l.pix),u())})}),document.querySelectorAll(".pay-status").forEach(d=>{d.addEventListener("change",i=>{const c=Number(i.target.dataset.idx),l=a.payments[c];l&&(l.status=i.target.value)})}),(t=document.getElementById("btn-msg-pix"))==null||t.addEventListener("click",()=>{a.messages.pagamentos=V(),u()}),(e=document.getElementById("btn-salvar-pag"))==null||e.addEventListener("click",y(Y)),(o=document.getElementById("msg-pag"))==null||o.addEventListener("input",d=>{a.messages.pagamentos=d.target.value}),(n=document.getElementById("copy-pag"))==null||n.addEventListener("click",()=>_(a.messages.pagamentos))}function ut(){var t,e,o;document.querySelectorAll("[data-edit-unit]").forEach(n=>{n.addEventListener("click",()=>{const d=n.getAttribute("data-edit-unit"),i=a.unidades.find(c=>c.id===d);i&&(document.getElementById("unit-id").value=i.id,document.getElementById("unit-nome").value=i.nome,document.getElementById("unit-ativo").checked=String(i.ativo)==="true")})}),document.querySelectorAll("[data-edit-prof]").forEach(n=>{n.addEventListener("click",()=>{const d=n.getAttribute("data-edit-prof"),i=a.profissionais.find(c=>c.id===d);i&&(document.getElementById("prof-id").value=i.id,document.getElementById("prof-unidade").value=i.unidade_id,document.getElementById("prof-nome").value=i.nome,document.getElementById("prof-pct").value=s(i.pct),document.getElementById("prof-pix").value=i.chave_pix||"",document.getElementById("prof-ativo").checked=String(i.ativo)==="true")})}),(t=document.getElementById("form-unidade"))==null||t.addEventListener("submit",y(async n=>{n.preventDefault(),await q({id:document.getElementById("unit-id").value||void 0,nome:document.getElementById("unit-nome").value,ativo:document.getElementById("unit-ativo").checked}),n.target.reset(),await w()})),(e=document.getElementById("form-prof"))==null||e.addEventListener("submit",y(async n=>{n.preventDefault(),await j({id:document.getElementById("prof-id").value||void 0,unidade_id:document.getElementById("prof-unidade").value,nome:document.getElementById("prof-nome").value,pct:s(document.getElementById("prof-pct").value),chave_pix:document.getElementById("prof-pix").value,ativo:document.getElementById("prof-ativo").checked}),n.target.reset(),await w()})),(o=document.getElementById("prof-unidade"))==null||o.addEventListener("change",n=>{a.selectedUnidade=n.target.value,b(),u()})}function mt(){a.activeTab==="dia"&&rt(),a.activeTab==="consolidado"&&lt(),a.activeTab==="pagamentos"&&ct(),a.activeTab==="cadastros"&&ut()}function u(){D&&(D.innerHTML=a.user?it():nt(),st(),mt())}function pt(t){D=t,u()}async function B(){if(a.user)try{v({loading:!0}),E(""),u(),await w()}catch(t){E(t.message)}finally{v({loading:!1}),u()}}function ft(){const t=window.netlifyIdentity;if(!t){E("Netlify Identity não carregado."),u();return}t.on("init",async e=>{v({user:e}),u(),await B()}),t.on("login",async e=>{v({user:e}),t.close(),u(),await B()}),t.on("logout",()=>{v({user:null,unidades:[],profissionais:[],consolidated:null,payments:[]}),u()}),t.on("error",e=>{const o=(e==null?void 0:e.message)||"Falha no Netlify Identity.";E(`Erro de autenticação: ${o}`),u()}),t.init()}pt(document.getElementById("app"));ft();
