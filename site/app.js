const container = document.getElementById("produtos");
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

function ordenarProdutos(produtos) {
  return [...produtos].sort((a, b) => {
    const nomeA = a?.nome || "";
    const nomeB = b?.nome || "";
    return nomeA.localeCompare(nomeB, "pt-BR", { sensitivity: "base" });
  });
}

function criarCardProduto(produto) {
  const a = document.createElement("a");
  a.className = "link-item";
  a.href = produto.link_afiliado;
  a.target = "_blank";
  a.rel = "noopener noreferrer";

  const icone = document.createElement("img");
  icone.className = "icone";
  icone.src = produto.icone || "https://via.placeholder.com/72x72.png?text=%F0%9F%9B%8D%EF%B8%8F";
  icone.alt = `Icone ${produto.nome}`;

  const nome = document.createElement("span");
  nome.className = "nome";
  nome.textContent = produto.nome;

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

  a.append(icone, conteudo);
  return a;
}

function renderizarProdutosPorMes(dados) {
  const meses = ordenarMeses(Object.keys(dados));

  if (!meses.length) {
    container.innerHTML = '<p class="vazio">Nenhum produto encontrado no JSON.</p>';
    return;
  }

  meses.forEach((mes, index) => {
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

    const produtosOrdenados = ordenarProdutos(dados[mes] || []);

    produtosOrdenados.forEach((produto) => {
      if (produto?.nome && produto?.link_afiliado) {
        lista.appendChild(criarCardProduto(produto));
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
}

async function carregarProdutos() {
  try {
    const resposta = await fetch("produtos.json");

    if (!resposta.ok) {
      throw new Error(`Falha ao carregar JSON (${resposta.status})`);
    }

    const dados = await resposta.json();
    renderizarProdutosPorMes(dados);
  } catch (erro) {
    container.innerHTML = `<p class="erro">Erro ao carregar produtos: ${erro.message}</p>`;
  }
}

carregarProdutos();
