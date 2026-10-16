/* Geo Rep order reporting. Nexus owns authentication and navigation. */
(function (global) {
  "use strict";
  const PAGES = {overview: "Executive Overview", trend: "Trend Analysis", regions: "Regional Performance", products: "Product Performance", stores: "Store Performance", reps: "Rep Performance", orders: "Order Detail"};
  const LABELS = {province: "Province", region: "Region", rep: "Rep", manager: "Manager", storeName: "Store", product: "Product", status: "Status", client: "Clients", banner: "Banner", channel: "Channel", brand: "Brand", category: "Category", currency: "Currency"};
  const COLUMNS = {orderDate: "Date", orderNumber: "Order", storeName: "Store", region: "Region", rep: "Rep", sku: "SKU", product: "Product", client: "Client", brand: "Brand", banner: "Banner", quantity: "Units", value: "Amount", status: "Status", poNumber: "PO number", manager: "Manager", unitPrice: "Unit price", storeCode: "Store code", currency: "Currency", source: "Source"};
  const DEFAULT_COLUMNS = ["orderDate", "orderNumber", "storeName", "product", "client", "brand", "banner", "quantity", "value", "status"];
  const GROUP_PAGES = {regions:"region", products:"product", stores:"storeName", reps:"rep"};
  const PLURALS = {region:"regions", rep:"reps", manager:"managers", storeName:"stores", product:"products", status:"statuses", client:"clients", banner:"banners", channel:"channels", brand:"brands", category:"categories", currency:"currencies"};
  const METRICS = {amount:"Order amount",orders:"Orders",units:"Units ordered",stores:"Stores ordering",averageOrder:"Average order",lines:"Order lines",reps:"Ordering reps"};
  const EXCEPTIONS = {unmapped:"Unmapped lines",missingRep:"Unassigned rep",missingOrderNumber:"Missing order reference",missingValues:"Missing amount",missingUnits:"Missing units",cancelled:"Cancelled lines"};
  const finite = Number.isFinite;
  const dateLabel = value => /^\d{4}-\d{2}(-\d{2})?$/.test(value || "") ? new Date(`${value.length === 7 ? value + "-01" : value}T00:00:00Z`).toLocaleDateString("en-ZA", {timeZone:"UTC", ...(value.length === 10 ? {day:"numeric"} : {}), month:"short", year:"numeric"}) : "Not available";
  function periodRange(latestPeriod, months = 1) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(latestPeriod || "")) return null;
    const [year, month] = latestPeriod.split("-").map(Number);
    return {start:new Date(Date.UTC(year, month - months, 1)).toISOString().slice(0,10), end:new Date(Date.UTC(year, month, 0)).toISOString().slice(0,10)};
  }
  function ranked(rows, key) {
    return [...rows].sort((a,b) => Number(finite(b[key])) - Number(finite(a[key])) || (finite(a[key]) && finite(b[key]) ? b[key]-a[key] : 0) || a.label.localeCompare(b.label));
  }
  function share(value, total, rows, field) {
    return finite(value) && finite(total) && total > 0 && value >= 0 && value <= total && rows.every(row => finite(row[field]) && row[field] >= 0) ? value / total * 100 : null;
  }
  function chartGeometry(series, field, width, height, compact = false) {
    const values = series.map(row => row[field]).filter(finite);
    if (!values.length) return null;
    const left = compact ? 5 : 64, right = compact ? 5 : 14, top = 12, bottom = compact ? 10 : 38;
    const min = Math.min(0, ...values), max = Math.max(0, ...values) || (min === 0 ? 1 : 0), span = max - min;
    const times = series.map(row => Date.parse(`${row.label.length === 7 ? row.label + "-01" : row.label}T00:00:00Z`));
    const gaps = times.slice(1).map((time,i) => time-times[i]).filter(value=>value>0);
    const step = gaps.length ? Math.min(...gaps) : 86400000, duration = times.at(-1)-times[0]+step;
    const plot = width-left-right, barWidth = Math.max(1,Math.min(compact ? 10 : 28,plot*step/duration*.68));
    const y = value => top + (max-value)/span*(height-top-bottom);
    return {left,right,top,bottom,min,max,zero:y(0),ticks:Array.from({length:4},(_,i)=>({value:min+span*i/3,y:y(min+span*i/3)})),points:series.map((row,i)=>({row,x:left+(times[i]-times[0]+step/2)/duration*plot,y:finite(row[field])?y(row[field]):null,width:barWidth,height:finite(row[field])?Math.max(2,Math.abs(y(row[field])-y(0))):null}))};
  }
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const fmt = (v, compact = false) => v === null || v === undefined ? "Not available" : new Intl.NumberFormat("en-ZA", {maximumFractionDigits: 2, ...(compact ? {notation:"compact", maximumFractionDigits:1} : {})}).format(v);
  const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
  const button = (action, name, label, extra = "") => `<button type="button" data-fo-action="${action}" title="${esc(label)}" aria-label="${esc(label)}" ${extra}>${icon(name)}</button>`;
  const csvCell = value => { const s = String(value ?? ""); return '"' + (/^[\s]*[=+@-]/.test(s) ? "'" : "") + s.replace(/"/g, '""') + '"'; };

  function mount(root, api, initialPage = "overview") {
    let stopped = false, generation = 0, data = null, page = PAGES[initialPage] ? initialPage : "overview", busy = false;
    let query = {filters: {}, sort: "newest", page: 1}, metric = "amount", columns = [...DEFAULT_COLUMNS], groupSort = "amount", exporting = false;
    let history = [], drillTitle = "", expandedLine = "";
    const abort = new AbortController();
    const amount = (value, compact = false) => {
      const currency = data?.totals.currency;
      if (value === null || value === undefined) return "Not available";
      if (/^[A-Z]{3}$/.test(currency || "")) return new Intl.NumberFormat("en-ZA", {style: "currency", currency, maximumFractionDigits: compact ? 1 : 2, ...(compact ? {notation:"compact"} : {})}).format(value);
      return fmt(value, compact);
    };
    const metricValue = value => metric === "amount" ? amount(value, true) : fmt(value, true);
    const title = () => PAGES[page];
    function syncNavigation() {
      document.querySelectorAll("[data-franchise-page]").forEach(node => {
        const active = node.dataset.franchisePage === page;
        node.classList.toggle("active", active); node.setAttribute("aria-current", active ? "page" : "false");
      });
    }
    function setPage(next) { if (!PAGES[next]) return; page = next; expandedLine = ""; if (page === "regions" && data?.totals.amount === 0 && data.totals.units > 0) { metric = "units"; groupSort = "units"; } if (data) render(); syncNavigation(); root.scrollTo?.({top:0}); }
    function header() {
      return `<header class="fo-heading"><div><p>FRANCHISE ORDERS</p><h1>${title()}</h1><div class="fo-period-label">${data ? `${icon("calendar-blank")} ${dateLabel(data.selection.start)} - ${dateLabel(data.selection.end)}` : "Geo Rep transactions"}</div></div><div class="fo-meta"><div class="fo-source"><span class="fo-badge">${icon("database")} ${data?.dataHosting?.provider === "Azure" ? "AZURE DATA" : "NEXUS DATA"}</span><small>${data?.latestImport ? `Imported ${esc(new Date(data.latestImport).toLocaleString("en-ZA", {dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Johannesburg"}))} SAST` : "Awaiting imported data"}</small><small class="fo-refresh-schedule">${data?.dataHosting?.provider === "Azure" ? "Azure import snapshot" : "Daily download 06:00 SAST"}</small></div><div class="fo-tools">${button("refresh","arrow-clockwise","Refresh Nexus orders")}${button("export","download-simple","Export filtered order lines",!data || busy ? "disabled" : "")}</div></div></header>`;
    }
    function note(message, error = false) {
      const target = root.querySelector(".fo-message");
      if (target) { target.textContent = message; target.hidden = !message; target.classList.toggle("error", error); }
    }
    async function load(refresh = false) {
      const id = ++generation; busy = true;
      const cached = !refresh && api.cached?.({...query,filters:{...query.filters}});
      if(cached){ data=cached; query={...cached.selection,filters:{...cached.selection.filters},export:false}; render(); }
      if (!data) root.innerHTML = `${header()}<div class="fo-message" role="status">Loading Geo Rep orders...</div><div class="fo-loading" aria-hidden="true">${Array.from({length:5},()=>'<div></div>').join("")}<section></section></div>`;
      else { note("Updating selected orders..."); root.querySelector(".fo-results")?.setAttribute("aria-busy", "true"); root.querySelectorAll('[data-fo-action="export"],[data-fo-action="next"],[data-fo-action="previous"]').forEach(b => b.disabled = true); }
      try {
        const result = await api({...query, filters:{...query.filters}, refresh});
        if (stopped || id !== generation) return;
        data = result; query = {...result.selection, filters:{...result.selection.filters}, export: false}; busy = false;
        if (page === "regions" && data.totals.amount === 0 && data.totals.units > 0) { metric = "units"; groupSort = "units"; }
        if (!finite(data.totals.amount) && finite(data.totals.units)) metric = "units";
        if (!finite(data.totals.amount) && groupSort === "amount") groupSort = finite(data.totals.units) ? "units" : "orders";
        render(); return true;
      } catch (error) {
        if (stopped || id !== generation) return;
        busy = false;
        if (data && !/permission-denied|unauthenticated/.test(error.code || "")) {
          query = {...data.selection, filters:{...data.selection.filters}, export:false}; render();
          note(`Could not update orders. Showing the last loaded selection. ${error.message || "Try Refresh again."}`, true);
        } else {
          data = null;
          root.innerHTML = `${header()}<section class="fo-empty" role="alert">${icon("warning-circle")}<h2>Orders could not be loaded</h2><p>${esc(error.message || "Please try again.")}</p><button type="button" data-fo-action="retry">${icon("arrow-clockwise")} Retry</button> <button type="button" data-fo-action="reset">Reset period and filters</button></section>`;
        }
        return false;
      }
    }
    function filter(key) {
      const current = query.filters[key] || "";
      const options = [...new Set([...(data.options[key] || []), ...(current ? [current] : [])])];
      return `<label><span>${LABELS[key]}</span><select data-fo-filter="${key}" aria-label="${LABELS[key]}"><option value="">All ${PLURALS[key]}</option>${options.map(value => `<option ${current === value ? "selected" : ""} value="${esc(value)}">${esc(value)}</option>`).join("")}</select></label>`;
    }
    const totalButton = (field, value, label = METRICS[field]) => `<button type="button" class="fo-text-button" data-fo-total="${field}" title="Open order lines: ${esc(label)}">${esc(value)}</button>`;
    const pickAttrs = (key, row) => `data-fo-pick="${key}" data-value="${esc(row.label)}" ${row.missing ? 'data-missing="true"' : ""}`;
    const periodAttrs = row => `data-fo-period="${esc(row.start || row.label)}" data-end="${esc(row.end || row.label)}"`;
    function lineChart(series, field, label, small = false) {
      if (!series.length) return `<p class="fo-muted">No recorded orders in this period.</p>`;
      if (["amount","averageOrder"].includes(field) && data.totals.currency === "Mixed currencies") return '<p class="fo-muted">Select one currency to chart order amounts.</p>';
      const width = small ? 240 : Math.max(240,Math.min(620, global.innerWidth > 1050 ? root.clientWidth/2-68 : root.clientWidth-80));
      const height = small ? 72 : width < 400 ? 220 : 250;
      const color = field === "units" || field === "orders" ? "#65afe1" : field === "stores" ? "#37c69b" : "#ff7b24";
      const geometry = chartGeometry(series,field,width,height,small);
      if (!geometry) return `<p class="fo-muted">${esc(label)} unavailable.</p>`;
      const {left,right,bottom,zero,ticks:scale,points} = geometry;
      const trace = global.FranchiseReference?.trace(geometry,field,small) || "";
      const grid = small ? "" : scale.map(t=>`<line x1="${left}" x2="${width-right}" y1="${t.y}" y2="${t.y}" class="fo-gridline"/><text x="${left-8}" y="${t.y+4}" text-anchor="end">${esc(fmt(t.value,true))}</text>`).join("");
      const bars = points.map(({row:r,x,y,width:w,height:h}) => {
        if (y === null) return "";
        const value = ["amount","averageOrder"].includes(field) ? amount(r[field]) : fmt(r[field]);
        const detail = `${dateLabel(r.start || r.label)}${r.end && r.end !== r.start ? ` to ${dateLabel(r.end)}` : ""}: ${label} ${value}; ${fmt(r.lines)} lines. Open order lines.`;
        return `<g class="fo-chart-point" role="button" tabindex="${x===geometry.points.find(p=>p.y!==null)?.x ? 0 : -1}" ${periodAttrs(r)} data-metric="${field}" aria-label="${esc(detail)}"><title>${esc(detail)}</title><rect class="fo-chart-hit" x="${x-Math.max(w,small?10:16)/2}" y="0" width="${Math.max(w,small?10:16)}" height="${height-bottom}" fill="transparent"/><rect class="fo-activity-bar" x="${x-w/2}" y="${r[field] >= 0 ? Math.max(0,zero-h) : zero}" width="${w}" height="${h}" rx="2" fill="${r[field]<0?'#f57469':color}"/></g>`;
      }).join("");
      const ticks = small ? "" : points.map(({row:r,x},i)=>i===0 || i===points.length-1 || (i%Math.max(1,Math.ceil(points.length/(width<400?3:4)))===0 && x-points[0].x>95 && points.at(-1).x-x>95) ? `<text x="${x}" y="${height-15}" text-anchor="${i===0?'start':i===points.length-1?'end':'middle'}">${esc(dateLabel(r.label).replace(/ 20\d{2}$/, ""))}</text>` : "").join("");
      return `<svg class="${small ? "fo-spark" : "fo-chart"}" viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(label)} by recorded ${small ? 'day' : data.trendKey}"><title>${esc(label)}</title>${grid}${trace}<line x1="${left}" x2="${width-right}" y1="${zero}" y2="${zero}" class="fo-chart-zero"/>${bars}${ticks}</svg>`;
    }
    function kpis() {
      const t = data.totals;
      const cards = [["Order amount",amount(t.amount,true),"amount",t.currency,"currency-circle-dollar","orders"], ["Orders",fmt(t.orders),"orders","Distinct order references","shopping-cart","orders"], ["Units ordered",fmt(t.units,true),"units",`${fmt(t.lines)} selected lines`,"package","products"], ["Stores ordering",fmt(t.stores),"stores",`${fmt(t.reps)} reps with orders`,"storefront","stores"], ["Average order",amount(t.averageOrder,true),"averageOrder","Selected amount per order","chart-line-up","orders"]];
      const daily = (data.dailyTrend || data.trend).slice(-31);
      return `<section class="fo-kpis" aria-label="Order performance">${cards.map(([label,value,key,note,name]) => {
        const peak = ["amount","averageOrder"].includes(key) && t.currency === "Mixed currencies" ? null : ranked(daily,key).find(r=>finite(r[key]));
        return `<article class="fo-kpi" data-fo-card="${key}"><div><span>${label}</span>${icon(name)}</div>${totalButton(key,value)}<small>${esc(note)}</small>${lineChart(daily,key,label,true)}<div class="fo-spark-caption"><span>${daily.length ? `${dateLabel(daily[0].label).replace(/ 20\d{2}$/,"")} - ${dateLabel(daily.at(-1).label).replace(/ 20\d{2}$/,"")}` : 'No recorded dates'}</span><span>${daily.length === 1 ? '1 recorded day' : `${daily.length} recorded days`}</span></div>${peak ? `<button type="button" class="fo-kpi-peak" ${periodAttrs(peak)} data-metric="${key}" title="Open peak day order lines">Peak ${esc(["amount","averageOrder"].includes(key)?amount(peak[key],true):fmt(peak[key],true))} ${icon("arrow-up-right")}</button>` : ""}</article>`;
      }).join("")}</section>`;
    }
    function bars(key, heading, maxRows = 8) {
      const rows = ranked(data.by[key], metric).slice(0,maxRows), max = Math.max(1,...rows.map(r => Math.abs(r[metric] || 0)));
      const comparable = metric !== "amount" || finite(data.totals.amount);
      return `<section class="fo-panel fo-ranking"><header><div><h2>${heading}</h2><small>Top ${rows.length} / ${metric === "amount" ? "recorded amount" : "units ordered"}</small></div>${icon(key === "product" ? "package" : key === "region" ? "map-pin" : key === "rep" ? "users" : "storefront")}</header>${rows.length && comparable ? rows.map((r,i) => `<button type="button" class="fo-bar-row" ${pickAttrs(key,r)} data-metric="${metric}"><span class="fo-rank">${String(i+1).padStart(2,"0")}</span><span class="fo-bar-name">${esc(r.label)}<small>${fmt(r.orders)} orders</small></span><span class="fo-track"><i style="width:${Math.abs(r[metric] || 0)/max*100}%" class="${r[metric] < 0 ? "negative" : ""}"></i></span><strong>${esc(metricValue(r[metric]))}</strong>${icon("caret-right")}</button>`).join("") : `<p class="fo-muted">${rows.length ? "Comparable amounts are unavailable for this selection." : "No orders match the filters."}</p>`}</section>`;
    }
    function intelligence() {
      const t = data.totals, key = GROUP_PAGES[page] || "region", groups = data.by[key];
      const field = finite(t.amount) ? "amount" : "units", leader = ranked(groups,field).find(r=>finite(r[field]));
      const peak = ranked(data.trend,field).find(r=>finite(r[field]));
      const value = v => field === "amount" ? amount(v,true) : `${fmt(v,true)} units`;
      const percent = leader ? share(leader[field], t[field], groups, field) : null;
      return `<section class="fo-intelligence"><header><h2>${page === "overview" ? "Order intelligence" : page === "trend" ? "Trend intelligence" : `${LABELS[key]} intelligence`}</h2><small>Current selection</small></header><p>${totalButton("orders",`${fmt(t.orders)} orders`)}${totalButton("amount",`${amount(t.amount,true)} recorded`)}${totalButton("units",`${fmt(t.units,true)} units`)}${totalButton("stores",`${fmt(t.stores)} stores ordering`)}</p><div class="fo-intel-grid"><article>${icon(key === "region" ? "map-pin" : key === "product" ? "package" : key === "rep" ? "users" : "storefront")}<div><h3>Leading ${LABELS[key].toLowerCase()}</h3>${leader ? `<button type="button" class="fo-insight-link" ${pickAttrs(key,leader)}><strong>${esc(leader.label)}</strong><span>${esc(value(leader[field]))}${percent !== null ? ` / ${fmt(percent)}% of selected ${field === "amount" ? "amount" : "units"}` : ""}</span></button>` : '<p>No comparable recorded values.</p>'}</div></article><article>${icon("chart-line-up")}<div><h3>Peak ${data.trendKey}</h3>${peak ? `<button type="button" class="fo-insight-link" ${periodAttrs(peak)}><strong>${dateLabel(peak.label)}</strong><span>${esc(value(peak[field]))} across ${fmt(peak.orders)} orders</span></button>` : '<p>No recorded activity in this period.</p>'}</div></article><article>${icon("users-three")}<div><h3>Field activity</h3>${totalButton("reps",`${fmt(t.reps)} ordering reps`)}<p>${totalButton("lines",`${fmt(data.quality.datesWithOrders)} dates with orders`)} / ${totalButton("stores",`${fmt(t.stores)} stores`)}</p></div></article></div></section>`;
    }
    function quality() {
      return `<details class="fo-quality"><summary>${icon("shield-check")} Source &amp; reconciliation <span>${data.quality.warnings.length ? `${data.quality.warnings.length} notices` : "Geo Rep ledger"}</span></summary><div><p>${esc(data.source)}. Amounts are recorded order values, not recognised revenue or confirmed payments.</p><div class="fo-quality-links">${Object.entries(EXCEPTIONS).map(([key,label])=>`<button type="button" class="fo-text-button" data-fo-exception="${key}">${fmt(key === "cancelled" ? data.quality.cancelled.lines : data.quality[key])} ${label.toLowerCase()}</button>`).join("")}</div><p>Cancelled lines are ${query.includeCancelled ? "included" : "excluded"} in displayed totals. Source statuses do not confirm delivery or payment.</p><p>Charts include recorded dates only. Missing dates are not confirmed zero-order days. Amounts are not compared across currencies or incomplete values.</p>${data.quality.warnings.map(w=>`<p>${esc(w)}</p>`).join("")}</div></details>`;
    }
    function metricControl() { return `<div class="fo-segment" role="group" aria-label="Chart metric">${[["amount","Amount"],["units","Units"]].map(([key,label]) => `<label><input type="radio" name="fo-metric" value="${key}" ${metric === key ? "checked" : ""} ${key === "amount" && !finite(data.totals.amount) ? "disabled" : ""}/><span>${label}</span></label>`).join("")}</div>`; }
    function chartPanel(field, heading) {
      const entries = data.trend.filter(r=>finite(r[field]));
      const peak = field === "amount" && data.totals.currency === "Mixed currencies" ? null : ranked(entries,field)[0];
      const total = field === "amount" ? amount(data.totals.amount,true) : fmt(data.totals[field],true);
      return `<section class="fo-panel fo-chart-panel"><header><div><h2>${heading}</h2><small>Recorded ${{day:"daily",week:"weekly",month:"monthly"}[data.trendKey]} activity</small></div>${page === "overview" ? `<button type="button" class="fo-text-button" data-fo-page="trend" title="Open Trend Analysis">Trend ${icon("arrow-up-right")}</button>` : icon("chart-bar")}</header><div class="fo-chart-summary">${totalButton(field,total)}${peak ? `<button type="button" class="fo-text-button" ${periodAttrs(peak)} data-metric="${field}">Peak ${dateLabel(peak.label)} / ${esc(field === "amount" ? amount(peak[field],true) : fmt(peak[field],true))}</button>` : '<span>No recorded activity</span>'}</div>${lineChart(data.trend,field,heading)}<footer><span class="fo-legend ${field === "units" ? "blue" : ""}"></span> Recorded activity <small>${dateLabel(query.start)} - ${dateLabel(query.end)}</small></footer></section>`;
    }
    function statuses() {
      const rows = ranked(data.by.status,"lines"), total = data.totals.lines;
      return `<section class="fo-status-band"><header><div><h2>Order status</h2><small>Share of selected order lines</small></div>${totalButton("lines",`${fmt(total)} lines`)}</header><div class="fo-status-track">${rows.map((r,i)=>`<button type="button" class="fo-tone-${i%5}" ${pickAttrs("status",r)} style="width:${total ? r.lines/total*100 : 0}%" title="${esc(r.label)}: ${fmt(r.lines)} lines" aria-label="Open ${esc(r.label)}: ${fmt(r.lines)} lines"></button>`).join("")}</div><div class="fo-status-list">${rows.map((r,i)=>`<button type="button" ${pickAttrs("status",r)}><i class="fo-dot fo-tone-${i%5}"></i><span>${esc(r.label)}</span><strong>${fmt(r.lines)}</strong><small>${fmt(total ? r.lines/total*100 : 0)}%</small></button>`).join("") || '<p class="fo-muted">No order statuses recorded.</p>'}</div></section>`;
    }
    function groupTable(key) {
      const rows = ranked(data.by[key],groupSort), columns = [["orders","Orders"],["units","Units"],["amount","Amount"],[key === "storeName" ? "averageOrder" : "stores",key === "storeName" ? "Avg order" : "Stores"]];
      const numeric = (row,field) => `<button type="button" class="fo-text-button" ${pickAttrs(key,row)} data-metric="${field}" title="Open ${esc(row.label)}: ${METRICS[field]}">${buttonValue(row,field)}</button>`;
      return `<section class="fo-table-section"><header><div><h2>${LABELS[key]} league table</h2><small>${fmt(data.groupCounts[key])} ${PLURALS[key]}${data.groupCounts[key] > 500 ? " / top 500 by amount supplied" : ""}</small></div><div class="fo-tools"><label><span class="sr-only">Rank ${PLURALS[key]} by</span><select data-fo-group-sort>${[["amount","Highest amount"],["units","Highest units"],["orders","Most orders"],["stores","Most stores"]].map(([k,v])=>`<option value="${k}" ${k===groupSort ? "selected" : ""} ${k==="amount" && !finite(data.totals.amount) ? "disabled" : ""}>${v}</option>`).join("")}</select></label>${button("exportGroups","download-simple","Export displayed summary")}</div></header><div class="fo-table-wrap" tabindex="0" aria-label="${LABELS[key]} league table"><table><thead><tr><th scope="col">#</th><th scope="col">${LABELS[key]}</th>${columns.map(([,label])=>`<th scope="col" class="fo-number">${label}</th>`).join("")}<th scope="col" class="fo-number">${metric === "amount" ? "Amount" : "Unit"} share</th></tr></thead><tbody>${rows.map((r,i)=>{const p=share(r[metric],data.totals[metric],data.by[key],metric);return `<tr><td class="fo-rank">${String(i+1).padStart(2,"0")}</td><td><button type="button" class="fo-text-button" ${pickAttrs(key,r)}>${esc(r.label)}</button></td>${columns.map(([field])=>`<td class="fo-number">${numeric(r,field)}</td>`).join("")}<td class="fo-number">${p === null ? "Not available" : `<button type="button" class="fo-text-button" ${pickAttrs(key,r)} data-metric="${metric}" title="Open share contribution"><span class="fo-share"><i style="width:${Math.min(100,p)}%"></i></span>${fmt(p)}%</button>`}</td></tr>`;}).join("") || '<tr><td colspan="7">No orders match the filters.</td></tr>'}</tbody><tfoot><tr><th colspan="2" scope="row">Full selection</th>${columns.map(([field])=>`<td class="fo-number">${totalButton(field,["amount","averageOrder"].includes(field)?amount(data.totals[field]):fmt(data.totals[field]))}</td>`).join("")}<td></td></tr></tfoot></table></div><footer class="fo-table-note">${totalButton("orders",`${fmt(data.totals.orders)} distinct orders`)} / ${totalButton("lines",`${fmt(data.totals.lines)} lines`)} in the full selection</footer></section>`;
    }
    function buttonValue(row,field) { return esc(["amount","averageOrder"].includes(field) ? data.totals.currency === "Mixed currencies" ? "Select currency" : amount(row[field]) : fmt(row[field])); }
    function reconciliation() {
      const t=data.totals;
      return `<section class="fo-reconciliation" aria-label="Selected line reconciliation"><header><div><h2>${esc(drillTitle || "Selected order lines")}</h2><small>${dateLabel(query.start)} - ${dateLabel(query.end)}</small></div>${history.length ? `<button type="button" data-fo-action="back" title="Return to ${esc(PAGES[history.at(-1).page])}">${icon("arrow-counter-clockwise")} Previous selection</button>` : ""}</header><p>${totalButton("lines",`${fmt(t.lines)} lines`)}<span>/</span>${totalButton("orders",`${fmt(t.orders)} distinct orders`)}<span>/</span>${totalButton("stores",`${fmt(t.stores)} stores`)}</p><p>Line amount ${totalButton("amount",amount(t.amount))}<span>/</span>Units ${totalButton("units",fmt(t.units))}</p><small>Average order: ${esc(amount(t.amount))} / ${fmt(t.orders)} distinct references = ${esc(amount(t.averageOrder))}. References are counted per store; missing references are excluded from the count and prevent an average. Distinct counts across dates or products may overlap.</small></section>`;
    }
    function lineDetails(row) {
      return `<tr class="fo-line-detail"><td colspan="${columns.length+1}"><header><strong>Source line ${esc(row.id)}</strong>${button("closeLine","x","Close source line")}</header><dl>${Object.entries({...COLUMNS,mapped:"Store mapped",cancelled:"Cancelled"}).map(([key,label])=>`<div><dt>${label}</dt><dd>${esc(row[key] === true ? "Yes" : row[key] === false ? "No" : row[key] ?? "Not supplied") || "Not supplied"}</dd></div>`).join("")}</dl></td></tr>`;
    }
    function orderCell(row,key) {
      const value = ["value","unitPrice"].includes(key) ? `${amount(row[key])}${data.totals.currency === "Mixed currencies" ? ` ${row.currency}` : ""}` : key === "quantity" ? fmt(row[key]) : key === "orderDate" ? dateLabel(row[key]) : row[key] || "Not supplied";
      if (key === "orderNumber" && row.orderKey) return `<button type="button" class="fo-text-button" data-fo-order="${esc(row.orderKey)}">${esc(value)}</button>`;
      if (["quantity","value","unitPrice"].includes(key)) return `<button type="button" class="fo-text-button" data-fo-line="${esc(row.id)}" title="Inspect source line">${esc(value)}</button>`;
      if (key === "status") return `<button type="button" class="fo-status ${row.cancelled?'cancelled':''}" ${pickAttrs(key,{label:row[key]})}><i></i>${esc(value)}</button>`;
      if (["storeName","region","rep","product","manager","client"].includes(key)) return `<button type="button" class="fo-text-button" ${pickAttrs(key,{label:row[key] || "Not supplied",missing:!row[key]})}>${esc(value)}</button>`;
      return esc(value);
    }
    function orders() {
      const rows = data.table.rows;
      return `<section class="fo-table-section"><header><div><h2 tabindex="-1" id="fo-order-lines">Order lines</h2><small>${totalButton("orders",`${fmt(data.totals.orders)} orders`)} / ${totalButton("lines",`${fmt(data.table.total)} matching lines`)}</small></div><div class="fo-tools"><label class="fo-sort"><span class="sr-only">Sort order lines</span><select data-fo-sort>${[["newest","Newest first"],["oldest","Oldest first"],["value","Highest amount"],["quantity","Highest units"]].map(([key,label])=>`<option value="${key}" ${query.sort===key?"selected":""}>${label}</option>`).join("")}</select></label><details class="fo-columns"><summary title="Choose columns">${icon("columns")} Columns</summary><div>${Object.entries(COLUMNS).map(([key,label])=>`<label><input type="checkbox" data-fo-column="${key}" ${columns.includes(key)?"checked":""}/> ${label}</label>`).join("")}<button type="button" data-fo-action="resetColumns">Reset columns</button></div></details></div></header>${query.orderKey ? `<p class="fo-drill">${icon("receipt")} Selected order: ${esc(rows[0]?.orderNumber || "No matching lines")}${button("clearOrder","x","Clear selected order")}</p>` : ""}<div class="fo-table-wrap" tabindex="0" aria-label="Order lines"><table><thead><tr>${columns.map(key=>`<th scope="col" class="${["value","quantity","unitPrice"].includes(key)?"fo-number":""}">${COLUMNS[key]}</th>`).join("")}<th scope="col"><span class="sr-only">Inspect</span></th></tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(key=>`<td class="${["value","quantity","unitPrice"].includes(key)?"fo-number":""}">${orderCell(row,key)}</td>`).join("")}<td><button type="button" class="fo-inspect" data-fo-line="${esc(row.id)}" aria-expanded="${expandedLine===row.id}" title="Inspect source line" aria-label="Inspect source line ${esc(row.id)}">${icon(expandedLine===row.id?"caret-up":"caret-down")}</button></td></tr>${expandedLine===row.id?lineDetails(row):""}`).join("") || `<tr><td colspan="${columns.length+1}">No orders match the filters.</td></tr>`}</tbody></table></div><footer class="fo-pagination"><span>${data.table.total?(data.table.page-1)*50+1:0}-${Math.min(data.table.page*50,data.table.total)} of ${totalButton("lines",fmt(data.table.total))} lines / page ${data.table.page} of ${data.table.pages}</span><div>${button("previous","caret-left","Previous page",data.table.page<=1?"disabled":"")}${button("next","caret-right","Next page",data.table.page>=data.table.pages?"disabled":"")}</div></footer></section>`;
    }
    function periods() {
      const fields = ["orders","units","amount","stores","averageOrder","lines"];
      return `<section class="fo-table-section"><header><div><h2>Recorded periods</h2><small>${data.trend.length} recorded ${data.trendKey} periods</small></div>${button("exportTrend","download-simple","Export recorded periods")}</header><div class="fo-table-wrap" tabindex="0" aria-label="Recorded periods"><table><thead><tr><th scope="col">Period</th>${fields.map(field=>`<th scope="col" class="fo-number">${METRICS[field]}</th>`).join("")}</tr></thead><tbody>${data.trend.map(row=>`<tr><td><button type="button" class="fo-text-button" ${periodAttrs(row)}>${dateLabel(row.label)}${data.trendKey==="week"?" (week)":""}</button></td>${fields.map(field=>`<td class="fo-number"><button type="button" class="fo-text-button" ${periodAttrs(row)} data-metric="${field}" title="Open ${METRICS[field]} for ${dateLabel(row.label)}">${buttonValue(row,field)}</button></td>`).join("")}</tr>`).join("") || '<tr><td colspan="7">No orders recorded.</td></tr>'}</tbody><tfoot><tr><th scope="row">Full selection</th>${fields.map(field=>`<td class="fo-number">${totalButton(field,["amount","averageOrder"].includes(field)?amount(data.totals[field]):fmt(data.totals[field]))}</td>`).join("")}</tr></tfoot></table></div></section>`;
    }
    function granularityControl() {
      return `<label class="fo-granularity"><span>Activity by</span><select data-fo-granularity>${[["auto","Automatic"],["day","Day"],["week","Week"],["month","Month"]].map(([key,label])=>`<option value="${key}" ${(query.granularity || "auto")===key?"selected":""}>${label}</option>`).join("")}</select></label>`;
    }
    function content() {
      if (page === "orders") return `${reconciliation()}${orders()}${kpis()}`;
      if (page === "overview") return `${kpis()}${intelligence()}<div class="fo-grid">${chartPanel("amount","Order amount")}${chartPanel("units","Order volume")}</div>${statuses()}<div class="fo-section-title"><h2>Performance leaders</h2>${metricControl()}</div><div class="fo-grid">${bars("region","Regional contribution",6)}${bars("product","Leading products",6)}</div>`;
      if (page === "trend") return `${kpis()}${intelligence()}${granularityControl()}<div class="fo-grid">${chartPanel("amount","Order amount")}${chartPanel("units","Order volume")}</div>${periods()}`;
      if (page === "regions" && global.FranchiseRegions) return global.FranchiseRegions.html(data,metric,{groupTable:()=>groupTable("region"),metricControl,granularityControl});
      const key = GROUP_PAGES[page];
      const secondary = {regions:["rep","Ordering reps"],products:["storeName","Ordering stores"],stores:["product","Product demand"],reps:["storeName","Store contribution"]}[page];
      return `${kpis()}${intelligence()}<div class="fo-section-title"><h2>${{regions:"Regional contribution",products:"Product demand",stores:"Store activity",reps:"Field performance"}[page]}</h2>${metricControl()}</div><div class="fo-grid">${bars(key,`Leading ${PLURALS[key]}`,6)}${bars(...secondary,6)}</div>${groupTable(key)}`;
    }
    function render() {
      const pendingQuery=query; query=data.selection;
      try {
      const optional = ["channel","brand","category","currency"].filter(key => query.filters[key] || data.options[key]?.some(v => !["Not supplied","Unassigned"].includes(v)));
      const filters = Object.entries(query.filters).filter(([,value])=>value);
      for(const key of query.missingFilters || []) filters.push([key,"Not supplied"]);
      const preset = [1,3,12].find(months=>{const range=periodRange(data.latestPeriod,months);return range?.start===query.start && range.end===query.end;}) || "custom";
      const chips = [...(query.orderKey ? [`<span>Order: ${esc(data.table.rows[0]?.orderNumber || "Selected order")}${button("clearOrder","x","Clear selected order")}</span>`] : []),...filters.map(([key,value])=>`<span>${LABELS[key]}: ${esc(value)}${button("removeFilter","x",`Remove ${LABELS[key]} filter`,`data-key="${key}"`)}</span>`), ...(query.query ? [`<span>Search: ${esc(query.query)}${button("clearSearch","x","Clear search")}</span>`] : []), ...(query.exceptions || []).map(key=>`<span>${EXCEPTIONS[key]}${button("clearException","x",`Remove ${EXCEPTIONS[key]} filter`,`data-key="${key}"`)}</span>`) ].join("");
      root.innerHTML = `${header()}<section class="fo-filter-band" aria-label="Franchise orders filters"><div class="fo-period-tools"><div class="fo-period-fields"><label><span>Reporting period</span><select data-fo-preset><option value="1" ${preset===1?"selected":""}>Latest data month</option><option value="3" ${preset===3?"selected":""}>Last 3 data months</option><option value="12" ${preset===12?"selected":""}>Last 12 data months</option><option value="custom" ${preset==="custom"?"selected":""}>Custom period</option></select></label><label><span>From</span><input type="date" data-fo-date="start" value="${query.start}"/></label><label><span>To</span><input type="date" data-fo-date="end" value="${query.end}"/></label></div><span>${totalButton("lines",`${fmt(data.table.total)} selected lines`)}</span></div><div class="fo-filter-grid">${["manager","banner","client","region","rep","storeName","product","status"].map(filter).join("")}</div><div class="fo-filter-actions"><form class="fo-search" role="search"><label><span class="sr-only">Search orders</span><input type="search" name="query" placeholder="Search order, store, SKU or rep" value="${esc(query.query || "")}" maxlength="120"/></label><button type="submit" aria-label="Search orders" title="Search orders">${icon("magnifying-glass")}</button></form><button type="button" class="fo-mobile-filters" data-fo-action="filters" aria-expanded="${root.classList.contains("fo-filters-expanded")}">${icon("funnel")} Filters</button><details class="fo-extra" ${optional.length ? "" : "hidden"}><summary>${icon("sliders-horizontal")} More filters</summary><div>${optional.map(filter).join("")}</div></details><label class="fo-checkbox"><input type="checkbox" data-fo-cancelled ${query.includeCancelled ? "checked" : ""} ${/^(cancelled|canceled|void|voided)$/i.test(query.filters.status || "") || query.exceptions?.includes("cancelled") ? 'disabled title="Included by the selected cancellation filter"' : ""}/> Include cancelled</label><button type="button" data-fo-action="reset">${icon("arrow-counter-clockwise")} Reset</button></div>${chips ? `<div class="fo-active-filters" aria-label="Active filters">${chips}</div>` : ""}</section><p class="fo-message" role="status" hidden></p><div class="fo-results" aria-busy="${busy}">${content()}${quality()}<p class="fo-footnote">${icon("database")} Geo Rep / Nexus live-data service <span>${query.includeCancelled ? "Cancelled included" : "Cancelled excluded"}</span></p></div>`;
      syncNavigation();
      global.FranchiseReference?.decorate(root,data,page);
      global.FranchiseRegions?.mount(root,page === "regions" ? data : null,metric,abort.signal);
      if (data.quality.warnings.length) root.querySelector(".fo-results").insertAdjacentHTML("afterbegin", `<details class="fo-notice"><summary>${icon("info")} ${data.quality.warnings.length} source data notices</summary>${data.quality.warnings.map(w=>`<p>${esc(w)}</p>`).join("")}</details>`);
      if (busy) { note("Updating selected orders..."); root.querySelectorAll('.fo-results button,.fo-results select,[data-fo-action="export"]').forEach(node=>node.disabled=true); }
      } finally { query=pendingQuery; }
    }
    function download(rows, fields, name) {
      const body = [fields.map(([,label])=>csvCell(label)).join(","),...rows.map(row=>fields.map(([key])=>csvCell(row[key])).join(","))].join("\r\n");
      const url = URL.createObjectURL(new Blob(["\uFEFF",body],{type:"text/csv;charset=utf-8"}));
      const link = document.createElement("a"); link.href=url; link.download=`Franchise_Orders_${name}_${query.start}_${query.end}.csv`; link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    async function drill(update, label = "Selected order lines") {
      if (busy) return;
      const previous = {query:{...query,filters:{...query.filters}},page,title:drillTitle,scroll:root.scrollTop};
      history.push(previous); expandedLine="";
      query = {...query,...update,page:1}; page="orders"; drillTitle=label;
      const loaded = await load();
      if (loaded === undefined) return;
      if (!loaded) { history.pop(); page=previous.page; drillTitle=previous.title; if(data)render(); note("Could not open the selected lines. Please try again.",true); }
      else { root.scrollTo?.({top:0}); root.querySelector(".fo-reconciliation h2")?.focus?.({preventScroll:true}); }
      syncNavigation();
    }
    root.addEventListener("change", event => {
      const target = event.target;
      if (target.matches("[data-fo-granularity]")) { query.granularity=target.value; load(); return; }
      if (target.matches('[name="fo-metric"]')) { metric = target.value; render(); return; }
      if (target.dataset.foColumn) { const key = target.dataset.foColumn; if (target.checked) columns.push(key); else if (columns.length > 1) columns = columns.filter(c => c !== key); else target.checked = true; render(); root.querySelector(".fo-columns").open=true; root.querySelector(`[data-fo-column="${key}"]`).focus({preventScroll:true}); return; }
      if (target.matches("[data-fo-group-sort]")) { groupSort=target.value; render(); root.querySelector("[data-fo-group-sort]").focus({preventScroll:true}); return; }
      if (target.matches("[data-fo-preset]")) {
        if (target.value === "custom") { root.querySelector('[data-fo-date="start"]').focus(); return; }
        const range=periodRange(data.latestPeriod,Number(target.value)); if (!range) return;
        query={...query,...range,orderKey:"",page:1}; drillTitle=""; load(); return;
      }
      if (target.dataset.foFilter) { query.filters[target.dataset.foFilter] = target.value; query.missingFilters=(query.missingFilters || []).filter(key=>key!==target.dataset.foFilter); }
      else if (target.dataset.foDate) query[target.dataset.foDate] = target.value;
      else if (target.matches("[data-fo-cancelled]")) query.includeCancelled = target.checked;
      else if (target.matches("[data-fo-sort]")) query.sort = target.value;
      else return;
      query.page = 1; drillTitle=""; expandedLine=""; load();
    }, {signal:abort.signal});
    root.addEventListener("submit", event => { if (!event.target.matches(".fo-search")) return; event.preventDefault(); query.query = new FormData(event.target).get("query"); query.page = 1; load(); }, {signal:abort.signal});
    root.addEventListener("click", async event => {
      const target = event.target.closest('button,[data-fo-period],[data-fo-card],[data-fr-province],[data-fr-point]'); if (!target || target.disabled) return;
      if (target.dataset.frProvince) { drill({filters:{...query.filters,province:target.dataset.frProvince}},`Province: ${target.dataset.frProvince}`); return; }
      if (target.dataset.frPoint) { drill({filters:{...query.filters,region:target.dataset.frPoint},start:target.dataset.start,end:target.dataset.end},`Region: ${target.dataset.frPoint}`); return; }
      if (target.dataset.foTotal || target.dataset.foCard) {
        if (busy) return;
        if (page === "orders") { root.querySelector("#fo-order-lines")?.focus(); root.querySelector(".fo-table-section")?.scrollIntoView({block:"start"}); }
        else drill({},METRICS[target.dataset.foTotal || target.dataset.foCard]);
        return;
      }
      if (target.dataset.foLine) { expandedLine=expandedLine===target.dataset.foLine?"":target.dataset.foLine; const scroll=root.scrollTop; render(); root.scrollTop=scroll; root.querySelector(`[data-fo-line="${CSS.escape(target.dataset.foLine)}"]`)?.focus({preventScroll:true}); return; }
      if (target.dataset.foException) { drill({exceptions:[...new Set([...(query.exceptions || []),target.dataset.foException])]},EXCEPTIONS[target.dataset.foException]); return; }
      if (target.dataset.foPage) { setPage(target.dataset.foPage); return; }
      if (target.dataset.foPick) { const key=target.dataset.foPick, missingFilters=(query.missingFilters || []).filter(field=>field!==key); if(target.dataset.missing)missingFilters.push(key); drill({filters:{...query.filters,[key]:target.dataset.missing?"":target.dataset.value},missingFilters},`${LABELS[key]}: ${target.dataset.value}${target.dataset.metric ? ` / ${METRICS[target.dataset.metric]}` : ""}`); return; }
      if (target.dataset.foPeriod) {
        const value=target.dataset.foPeriod, range=value.length===7 ? periodRange(value) : {start:value,end:target.dataset.end || value};
        drill({start:range.start < query.start ? query.start : range.start,end:range.end > query.end ? query.end : range.end},`${dateLabel(range.start)}${range.end!==range.start?` - ${dateLabel(range.end)}`:""}${target.dataset.metric ? ` / ${METRICS[target.dataset.metric]}` : ""}`); return;
      }
      if (target.dataset.foOrder) { drill({orderKey:target.dataset.foOrder},`Order: ${target.textContent}`); return; }
      const action = target.dataset.foAction;
      if (action === "closeLine") { expandedLine=""; render(); return; }
      if (action === "clearException") { query.exceptions=(query.exceptions || []).filter(key=>key!==target.dataset.key); drillTitle=""; query.page=1; load(); return; }
      if (action === "back" && history.length && !busy) {
        const previous=history.at(-1), current={page,title:drillTitle}; query={...previous.query,filters:{...previous.query.filters}}; page=previous.page; drillTitle=previous.title; expandedLine="";
        const loaded=await load(); if(loaded===undefined)return;
        if(loaded) { history.pop(); render(); root.scrollTop=previous.scroll; }
        else { page=current.page; drillTitle=current.title; if(data)render(); note("Could not return to the previous selection. Please try again.",true); }
        syncNavigation(); return;
      }
      if (action === "filters") { const open = root.classList.toggle("fo-filters-expanded"); target.setAttribute("aria-expanded", String(open)); return; }
      if (action === "removeFilter") { query.filters[target.dataset.key]=""; query.missingFilters=(query.missingFilters || []).filter(key=>key!==target.dataset.key); query.page=1; drillTitle=""; load(); return; }
      if (action === "clearSearch") { query.query=""; query.page=1; drillTitle=""; load(); return; }
      if (action === "resetColumns") { columns=[...DEFAULT_COLUMNS]; render(); return; }
      if (action === "exportGroups" && !busy) {
        const key=GROUP_PAGES[page]; download(ranked(data.by[key],groupSort),[["label",LABELS[key]],["orders","Orders"],["units","Units"],["amount","Amount"],["stores","Stores"],["averageOrder","Average order"],["currency","Currency"]],page);
        note(`${fmt(data.by[key].length)} displayed summary rows exported.`); return;
      }
      if (action === "exportTrend" && !busy) { download(data.trend,[["label","Period"],["start","From"],["end","To"],["orders","Orders"],["units","Units"],["amount","Amount"],["stores","Stores"],["averageOrder","Average order"],["lines","Lines"],["currency","Currency"]],"periods"); note("Recorded periods exported."); return; }
      if (action === "reset") { history=[]; drillTitle=""; expandedLine=""; query = {filters:{},page:1,sort:"newest"}; load(); }
      if (action === "retry" || action === "refresh") load(true);
      if (action === "clearOrder") { query.orderKey = ""; query.page = 1; drillTitle=""; load(); }
      if (["next","previous"].includes(action) && !busy) { query.page += action === "next" ? 1 : -1; load(); }
      if (action === "export" && !busy && data && !exporting) {
        exporting = true; target.disabled = true; const id = generation; note("Preparing filtered export...");
        try {
          const result = await api({...query, filters:{...query.filters}, export:true, version:data.version}); if (stopped || id !== generation) return;
          download(result.table.rows,Object.entries(COLUMNS),"lines"); note(`${fmt(result.table.total)} order lines exported.`);
        } catch(error) { if (!stopped && id === generation) note(error.message || "Export failed.",true); }
        finally { exporting = false; if (!stopped && id === generation) target.disabled = false; }
      }
    }, {signal:abort.signal});
    root.addEventListener("keydown", event => {
      if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-fr-province],[data-fr-point]")) { event.preventDefault(); event.target.dispatchEvent(new MouseEvent("click",{bubbles:true})); }
      if ((event.key === "Enter" || event.key === " ") && event.target.matches('.fo-chart-point')) { event.preventDefault(); event.target.dispatchEvent(new MouseEvent("click",{bubbles:true})); }
      if (["ArrowLeft","ArrowRight","Home","End"].includes(event.key) && event.target.matches('.fo-chart-point')) {
        event.preventDefault(); const points=[...event.target.closest("svg").querySelectorAll('.fo-chart-point')], index=points.indexOf(event.target);
        const next=event.key==="Home"?0:event.key==="End"?points.length-1:Math.max(0,Math.min(points.length-1,index+(event.key==="ArrowRight"?1:-1)));
        points.forEach((point,i)=>point.setAttribute("tabindex",i===next?"0":"-1")); points[next].focus();
      }
    }, {signal:abort.signal});
    let resizeTimer;
    global.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer=setTimeout(()=>{if (!stopped && data && !busy) render();},160); }, {signal:abort.signal});
    syncNavigation(); load();
    return {setPage, stop() { stopped = true; generation++; abort.abort(); clearTimeout(resizeTimer); data = null; root.classList.remove("fo-filters-expanded"); root.replaceChildren(); }};
  }
  global.FranchiseOrders = {mount, pages:PAGES, csvCell, periodRange, ranked, share, chartGeometry};
})(window);
