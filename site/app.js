const container = document.getElementById("produtos");
const buscaInput = document.getElementById("busca-produto");
const ultimaAtualizacaoEl = document.getElementById("ultima-atualizacao");
const localidadeUsuario = detectarLocalidadeUsuario();
const CACHE_TRADUCAO_CHAVE = "cache_traducao_produtos_v1";
const TEXTOS_PADRAO_UI = {
  mostrar: "Mostrar",
  esconder: "Esconder",
  verOferta: "Ver oferta",
  novo: "Novo",
  iconePrefixo: "Icone",
  linkSeguro: "Link seguro",
  destinoPrefixo: "Destino",
  linkExternoSeguro: "Link externo seguro",
  nenhumProdutoMes: "Nenhum produto neste mes.",
  nenhumNoJson: "Nenhum produto encontrado no JSON.",
  nenhumBusca: "Nenhum produto encontrado para essa busca.",
  carregando: "Carregando produtos...",
  ultimaAtualizacao: "Última atualização",
  erroCarregar: "Erro ao carregar produtos",
  schemaNome: "Produtos recomendados e ofertas",
};
let textosUI = { ...TEXTOS_PADRAO_UI };
let dadosProdutosAtuais = {};
const ORDEM_MESES = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const MAPA_MES_PARA_INDICE = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

function detectarLocalidadeUsuario() {
  const localeBruto = (navigator.languages && navigator.languages[0]) || navigator.language || "pt-BR";
  const localeNormalizado = localeBruto.replace("_", "-");
  const partes = localeNormalizado.split("-");
  const idioma = (partes[0] || "pt").toLowerCase();
  const pais = (partes[1] || "").toUpperCase();

  return {
    locale: localeNormalizado,
    localeLower: localeNormalizado.toLowerCase(),
    idioma,
    pais,
  };
}

function determinarIdiomaDestino(localidade) {
  const idioma = (localidade?.idioma || "pt").toLowerCase();
  return idioma || "pt";
}

function t(chave) {
  return textosUI[chave] || TEXTOS_PADRAO_UI[chave] || chave;
}

function carregarCacheTraducao() {
  try {
    const salvo = localStorage.getItem(CACHE_TRADUCAO_CHAVE);
    if (!salvo) return {};
    const parseado = JSON.parse(salvo);
    return parseado && typeof parseado === "object" ? parseado : {};
  } catch {
    return {};
  }
}

function salvarCacheTraducao(cache) {
  try {
    localStorage.setItem(CACHE_TRADUCAO_CHAVE, JSON.stringify(cache));
  } catch {
    // Ignora falhas de armazenamento (ex.: modo privado)
  }
}

function obterNomeExibicao(produto) {
  return produto?.nome_exibicao || produto?.nome || "";
}

function extrairDominio(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function atualizarIndicadorAtualizacao(dataReferencia = new Date()) {
  if (!ultimaAtualizacaoEl) return;
  const dataFormatada = new Intl.DateTimeFormat(localidadeUsuario.locale || "pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(dataReferencia);
  ultimaAtualizacaoEl.textContent = `${t("ultimaAtualizacao")}: ${dataFormatada}`;
}

async function traduzirTextoTempoReal(texto, idiomaDestino) {
  if (!texto || idiomaDestino === "pt") {
    return texto;
  }

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=pt|${encodeURIComponent(
    idiomaDestino
  )}`;

  const resposta = await fetch(url);
  if (!resposta.ok) {
    throw new Error(`Falha de traducao (${resposta.status})`);
  }

  const dados = await resposta.json();
  const traducao = dados?.responseData?.translatedText;
  return typeof traducao === "string" && traducao.trim() ? traducao : texto;
}

async function traduzirComCache(texto, idiomaDestino) {
  if (!texto || idiomaDestino === "pt") {
    return texto;
  }

  const cache = carregarCacheTraducao();
  const chave = `${idiomaDestino}::${texto}`;
  if (cache[chave]) {
    return cache[chave];
  }

  const traduzido = await traduzirTextoTempoReal(texto, idiomaDestino).catch(() => texto);
  cache[chave] = traduzido;
  salvarCacheTraducao(cache);
  return traduzido;
}

async function prepararTextosUI(idiomaDestino) {
  if (idiomaDestino === "pt") {
    textosUI = { ...TEXTOS_PADRAO_UI };
    return;
  }

  const entradas = Object.entries(TEXTOS_PADRAO_UI);
  const traduzidos = await Promise.all(
    entradas.map(async ([chave, valor]) => [chave, await traduzirComCache(valor, idiomaDestino)])
  );

  textosUI = Object.fromEntries(traduzidos);
}

async function traduzirTextosEstaticosDaPagina(idiomaDestino) {
  if (idiomaDestino === "pt") {
    return;
  }

  const raiz = document.querySelector("main.container");
  if (!raiz) return;

  const nosTexto = [];
  const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const no = walker.currentNode;
    if (!no || !no.nodeValue) continue;
    if (no.parentElement && no.parentElement.closest("#produtos")) continue;
    const valor = no.nodeValue.trim();
    if (!valor) continue;
    nosTexto.push(no);
  }

  const atributos = ["placeholder", "aria-label", "title"];
  const nosAtributos = [];
  raiz.querySelectorAll("*").forEach((el) => {
    if (el.closest("#produtos")) return;
    atributos.forEach((atributo) => {
      const valor = el.getAttribute(atributo);
      if (valor && valor.trim()) {
        nosAtributos.push({ el, atributo, valor });
      }
    });
  });

  const textosUnicos = new Set();
  nosTexto.forEach((no) => textosUnicos.add(no.nodeValue.trim()));
  nosAtributos.forEach((item) => textosUnicos.add(item.valor.trim()));

  const mapaTraducao = {};
  await Promise.all(
    Array.from(textosUnicos).map(async (textoOriginal) => {
      mapaTraducao[textoOriginal] = await traduzirComCache(textoOriginal, idiomaDestino);
    })
  );

  nosTexto.forEach((no) => {
    const original = no.nodeValue.trim();
    no.nodeValue = mapaTraducao[original] || no.nodeValue;
  });

  nosAtributos.forEach(({ el, atributo, valor }) => {
    const original = valor.trim();
    el.setAttribute(atributo, mapaTraducao[original] || valor);
  });
}

async function aplicarTraducaoNosProdutos(dados, idiomaDestino) {
  if (idiomaDestino === "pt") {
    return dados;
  }

  const cache = carregarCacheTraducao();
  const cacheAtualizado = { ...cache };
  const promessasUnicas = new Map();

  Object.keys(dados).forEach((mes) => {
    (dados[mes] || []).forEach((produto) => {
      const nomeOriginal = produto?.nome || "";
      if (!nomeOriginal) {
        produto.nome_exibicao = "";
        return;
      }

      const chave = `${idiomaDestino}::${nomeOriginal}`;
      const emCache = cacheAtualizado[chave];

      if (emCache) {
        produto.nome_exibicao = emCache;
        return;
      }

      if (!promessasUnicas.has(chave)) {
        promessasUnicas.set(chave, traduzirTextoTempoReal(nomeOriginal, idiomaDestino).catch(() => nomeOriginal));
      }
    });
  });

  const entradas = Array.from(promessasUnicas.entries());
  await Promise.all(
    entradas.map(async ([chave, promessa]) => {
      const traduzido = await promessa;
      cacheAtualizado[chave] = traduzido;
    })
  );

  Object.keys(dados).forEach((mes) => {
    (dados[mes] || []).forEach((produto) => {
      const nomeOriginal = produto?.nome || "";
      const chave = `${idiomaDestino}::${nomeOriginal}`;
      produto.nome_exibicao = cacheAtualizado[chave] || nomeOriginal;
    });
  });

  salvarCacheTraducao(cacheAtualizado);
  return dados;
}

function normalizarMes(valor) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function traduzirNomeMes(mes, localidade) {
  const indiceMes = MAPA_MES_PARA_INDICE[normalizarMes(mes)];
  if (indiceMes === undefined) {
    return mes;
  }

  try {
    const formatter = new Intl.DateTimeFormat(localidade?.locale || "pt-BR", {
      month: "long",
      timeZone: "UTC",
    });
    return formatter.format(new Date(Date.UTC(2024, indiceMes, 1)));
  } catch {
    return mes;
  }
}

function ordenarMeses(meses) {
  return [...meses].sort((a, b) => {
    const aIndex = ORDEM_MESES.indexOf(normalizarMes(a));
    const bIndex = ORDEM_MESES.indexOf(normalizarMes(b));
    const aValor = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const bValor = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    return aValor - bValor || a.localeCompare(b, "pt-BR");
  });
}

function ordenarProdutos(produtos, localidade) {
  const idiomaDestino = determinarIdiomaDestino(localidade);
  return [...produtos].sort((a, b) => {
    const nomeA = obterNomeExibicao(a);
    const nomeB = obterNomeExibicao(b);
    return nomeA.localeCompare(nomeB, idiomaDestino, { sensitivity: "base" });
  });
}

function criarCardProduto(produto, localidade) {
  const nomeExibicao = obterNomeExibicao(produto);
  const dominioDestino = extrairDominio(produto.link_afiliado);
  const a = document.createElement("a");
  a.className = "link-item";
  a.href = produto.link_afiliado;
  a.target = "_blank";
  a.rel = "noopener noreferrer sponsored";
  a.title = `${t("verOferta")}: ${nomeExibicao}`;

  const icone = document.createElement("img");
  icone.className = "icone";
  icone.src = produto.icone || "https://via.placeholder.com/72x72.png?text=%F0%9F%9B%8D%EF%B8%8F";
  icone.alt = `${t("iconePrefixo")} ${nomeExibicao}`;
  icone.loading = "lazy";
  icone.decoding = "async";

  const nome = document.createElement("span");
  nome.className = "nome";
  nome.textContent = nomeExibicao;

  const conteudo = document.createElement("div");
  conteudo.className = "conteudo";
  conteudo.appendChild(nome);

  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = dominioDestino
    ? `${t("destinoPrefixo")}: ${dominioDestino} | ${t("linkSeguro")}`
    : t("linkExternoSeguro");
  conteudo.appendChild(meta);

  if (produto.novo) {
    a.classList.add("link-item--novo");
    const badge = document.createElement("span");
    badge.className = "badge-novo";
    badge.textContent = t("novo");
    conteudo.appendChild(badge);
  }

  const cta = document.createElement("span");
  cta.className = "cta";
  cta.textContent = t("verOferta");

  a.append(icone, conteudo, cta);
  return a;
}

function renderizarProdutosPorMes(dados, termoBusca = "") {
  container.innerHTML = "";
  const termo = termoBusca.trim().toLowerCase();
  const meses = ordenarMeses(Object.keys(dados));

  if (!meses.length) {
    container.innerHTML = `<p class="vazio">${t("nenhumNoJson")}</p>`;
    return;
  }

  meses.forEach((mes, index) => {
    const produtosMes = dados[mes] || [];
    const produtosFiltrados = produtosMes.filter((produto) => {
      const nomeExibicao = obterNomeExibicao(produto).toLowerCase();
      return !termo || nomeExibicao.includes(termo);
    });

    if (!produtosFiltrados.length) {
      return;
    }

    const secaoMes = document.createElement("section");
    secaoMes.className = "month";

    const cabecalho = document.createElement("div");
    cabecalho.className = "month-header";

    const titulo = document.createElement("h2");
    titulo.textContent = traduzirNomeMes(mes, localidadeUsuario);

    const botaoToggle = document.createElement("button");
    botaoToggle.type = "button";
    botaoToggle.className = "toggle-mes";

    const lista = document.createElement("div");
    lista.className = "links";
    lista.id = `lista-${normalizarMes(mes)}-${index}`;

    const iniciarAberto = index === 0;
    lista.hidden = !iniciarAberto;
    botaoToggle.textContent = iniciarAberto ? t("esconder") : t("mostrar");
    botaoToggle.setAttribute("aria-expanded", String(iniciarAberto));
    botaoToggle.setAttribute("aria-controls", lista.id);

    botaoToggle.addEventListener("click", () => {
      const aberto = botaoToggle.getAttribute("aria-expanded") === "true";
      const proximoEstado = !aberto;
      botaoToggle.setAttribute("aria-expanded", String(proximoEstado));
      botaoToggle.textContent = proximoEstado ? t("esconder") : t("mostrar");
      lista.hidden = !proximoEstado;
    });

    const produtosOrdenados = ordenarProdutos(produtosFiltrados, localidadeUsuario);

    produtosOrdenados.forEach((produto) => {
      if (produto?.nome && produto?.link_afiliado) {
        lista.appendChild(criarCardProduto(produto, localidadeUsuario));
      }
    });

    if (!lista.children.length) {
      const vazioMes = document.createElement("p");
      vazioMes.className = "vazio";
      vazioMes.textContent = t("nenhumProdutoMes");
      lista.appendChild(vazioMes);
    }

    cabecalho.append(titulo, botaoToggle);
    secaoMes.append(cabecalho, lista);
    container.appendChild(secaoMes);
  });

  if (!container.children.length) {
    container.innerHTML = `<p class="vazio">${t("nenhumBusca")}</p>`;
  }
}

function adicionarJsonLd(dados) {
  const produtos = [];
  Object.keys(dados).forEach((mes) => {
    (dados[mes] || []).forEach((produto) => {
      if (!produto?.link_afiliado || !produto?.nome) return;
      produtos.push({
        "@type": "ListItem",
        position: produtos.length + 1,
        url: produto.link_afiliado,
        name: obterNomeExibicao(produto),
        image: produto.icone || undefined,
      });
    });
  });

  if (!produtos.length) {
    return;
  }

  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t("schemaNome"),
    itemListElement: produtos,
  };

  const antigo = document.getElementById("schema-produtos");
  if (antigo) antigo.remove();

  const script = document.createElement("script");
  script.id = "schema-produtos";
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

function configurarBusca() {
  if (!buscaInput) return;
  buscaInput.addEventListener("input", () => {
    renderizarProdutosPorMes(dadosProdutosAtuais, buscaInput.value);
  });
}

async function carregarProdutos() {
  try {
    const idiomaDestino = determinarIdiomaDestino(localidadeUsuario);
    await prepararTextosUI(idiomaDestino);
    await traduzirTextosEstaticosDaPagina(idiomaDestino);
    container.innerHTML = `<p class="vazio">${t("carregando")}</p>`;

    const resposta = await fetch("produtos.json");

    if (!resposta.ok) {
      throw new Error(`Falha ao carregar JSON (${resposta.status})`);
    }

    const dados = await resposta.json();
    const dadosTraduzidos = await aplicarTraducaoNosProdutos(dados, idiomaDestino);
    dadosProdutosAtuais = dadosTraduzidos;
    renderizarProdutosPorMes(dadosProdutosAtuais, buscaInput?.value || "");
    adicionarJsonLd(dadosProdutosAtuais);
    configurarBusca();
    atualizarIndicadorAtualizacao(new Date());
  } catch (erro) {
    container.innerHTML = `<p class="erro">${t("erroCarregar")}: ${erro.message}</p>`;
  }
}

carregarProdutos();
