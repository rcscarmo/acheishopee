const container = document.getElementById("produtos");
const buscaInput = document.getElementById("busca-produto");
const localidadeUsuario = detectarLocalidadeUsuario();
const CACHE_TRADUCAO_CHAVE = "cache_traducao_produtos_v1";
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
        promessasUnicas.set(
          chave,
          traduzirTextoTempoReal(nomeOriginal, idiomaDestino).catch(() => nomeOriginal)
        );
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
  const a = document.createElement("a");
  a.className = "link-item";
  a.href = produto.link_afiliado;
  a.target = "_blank";
  a.rel = "noopener noreferrer sponsored";
  a.title = `Ver oferta de ${nomeExibicao}`;

  const icone = document.createElement("img");
  icone.className = "icone";
  icone.src = produto.icone || "https://via.placeholder.com/72x72.png?text=%F0%9F%9B%8D%EF%B8%8F";
  icone.alt = `Icone ${nomeExibicao}`;
  icone.loading = "lazy";
  icone.decoding = "async";

  const nome = document.createElement("span");
  nome.className = "nome";
  nome.textContent = nomeExibicao;

  const conteudo = document.createElement("div");
  conteudo.className = "conteudo";
  conteudo.appendChild(nome);

  if (produto.novo) {
    a.classList.add("link-item--novo");
    const badge = document.createElement("span");
    badge.className = "badge-novo";
    badge.textContent = "Novo";
    conteudo.appendChild(badge);
  }

  const cta = document.createElement("span");
  cta.className = "cta";
  cta.textContent = "Ver oferta";

  a.append(icone, conteudo, cta);
  return a;
}

function renderizarProdutosPorMes(dados, termoBusca = "") {
  container.innerHTML = "";
  const termo = termoBusca.trim().toLowerCase();
  const meses = ordenarMeses(Object.keys(dados));

  if (!meses.length) {
    container.innerHTML = '<p class="vazio">Nenhum produto encontrado no JSON.</p>';
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
    titulo.textContent = mes;

    const botaoToggle = document.createElement("button");
    botaoToggle.type = "button";
    botaoToggle.className = "toggle-mes";

    const lista = document.createElement("div");
    lista.className = "links";
    lista.id = `lista-${normalizarMes(mes)}-${index}`;

    const iniciarAberto = index === 0;
    lista.hidden = !iniciarAberto;
    botaoToggle.textContent = iniciarAberto ? "Esconder" : "Mostrar";
    botaoToggle.setAttribute("aria-expanded", String(iniciarAberto));
    botaoToggle.setAttribute("aria-controls", lista.id);

    botaoToggle.addEventListener("click", () => {
      const aberto = botaoToggle.getAttribute("aria-expanded") === "true";
      const proximoEstado = !aberto;
      botaoToggle.setAttribute("aria-expanded", String(proximoEstado));
      botaoToggle.textContent = proximoEstado ? "Esconder" : "Mostrar";
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
      vazioMes.textContent = "Nenhum produto neste mes.";
      lista.appendChild(vazioMes);
    }

    cabecalho.append(titulo, botaoToggle);
    secaoMes.append(cabecalho, lista);
    container.appendChild(secaoMes);
  });

  if (!container.children.length) {
    container.innerHTML = '<p class="vazio">Nenhum produto encontrado para essa busca.</p>';
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
    name: "Produtos recomendados e ofertas",
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
    container.innerHTML = '<p class="vazio">Carregando produtos...</p>';

    const resposta = await fetch("produtos.json");

    if (!resposta.ok) {
      throw new Error(`Falha ao carregar JSON (${resposta.status})`);
    }

    const dados = await resposta.json();
    const idiomaDestino = determinarIdiomaDestino(localidadeUsuario);
    const dadosTraduzidos = await aplicarTraducaoNosProdutos(dados, idiomaDestino);
    dadosProdutosAtuais = dadosTraduzidos;
    renderizarProdutosPorMes(dadosProdutosAtuais, buscaInput?.value || "");
    adicionarJsonLd(dadosProdutosAtuais);
    configurarBusca();
  } catch (erro) {
    container.innerHTML = `<p class="erro">Erro ao carregar produtos: ${erro.message}</p>`;
  }
}

carregarProdutos();
