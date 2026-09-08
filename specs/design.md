# Especificações de Design

## 1. Conceito Visual Base
Com base na referência visual providenciada ("MagicAI Dashboard"), o design do Postfy será caracterizado por uma interface **clean e minimalista**, focada na utilidade e em dados legíveis. O espaço em branco abundante deve ditar o ritmo visual, com aplicações precisas de **cor (10% Roxo)** para guiar a atenção do usuário. O design deve suportar graciosamente tanto o Light Mode quanto o Dark Mode.

## 2. Paleta de Cores (White + 10% Purple + Dark Mode)
* **Light Mode (Clean):**
    * **Fundo principal (Canvas):** Branco (`bg-white` ou `bg-slate-50`).
    * **Superfícies (Cards, Sidebar, Navbar):** Branco puro (`bg-white`) com bordas extremamente sutis (`border-slate-100` ou `border-slate-200`).
    * **Acento Principal (Roxo - 10%):** Utilizado em botões primários (CTAs), badges de destaque, ícones ativos e links. Tons recomendados: `purple-600` para botões e `purple-100` para fundos sutis de destaque.
    * **Texto e Tipografia:** `text-slate-900` para cabeçalhos de alta hierarquia, `text-slate-500` ou `text-slate-600` para corpo de texto, legendas e rótulos secundários.
* **Dark Mode:**
    * **Fundo principal (Canvas):** `bg-slate-950` ou `bg-gray-950`.
    * **Superfícies (Cards):** `bg-slate-900` com divisórias `border-slate-800`.
    * **Acento Principal (Roxo):** `purple-500` para garantir alta acessibilidade e contraste vibrante contra o fundo escuro.
    * **Texto:** Branco puro (`text-white`) e cinza claro (`text-slate-400`).

## 3. Tipografia
* **Família:** Sans-serif limpa, moderna e sem serifa (Inter, como padrão moderno de SaaS).
* **Escala e Hierarquia:**
    * Headers (H1/H2) com peso `semibold`, limpos, sem uso exagerado de maiúsculas (uppercase).
    * Corpo do texto base de `14px` (`text-sm`) para a interface administrativa (tabelas, kanban) a fim de otimizar a densidade.
* **Labels/Pills:** Botões secundários, rótulos de status e abas usam uma linha única de texto (white-space: nowrap), com peso `medium` para clareza.

## 4. Estrutura e Layout
* **Navegação (Layout em "L"):** Sidebar fixa à esquerda (navegação de módulos) e Topbar superior (buscas e perfis).
* **Cards e Módulos:**
    * Raios de borda suaves. Recomenda-se `rounded-xl` ou `rounded-2xl` para os containers principais (sem exageros circulares).
    * Ausência de sombras pesadas. Utilizar bordas sutis de 1px em Light Mode, priorizando um visual mais plano e moderno (flat-clean design).
    * Paddings internos matemáticos. A distância de margem externa deve ser sempre igual ou maior que a margem interna (`p-6` para containers pais, `p-4` internos).

## 5. Tratamento de Imagens e Ícones
* **Ícones:** Traços finos e padronizados da biblioteca Lucide.
* **Logotipos de Redes (Facebook, Instagram, etc):** As cores originais das marcas devem ser usadas em listagens para rápida identificação visual.
* **Avatares:** Pessoas usam formato circular (`rounded-full`), conteúdo/imagens (thumbnails de posts) usam retângulo com cantos levemente arredondados (`rounded-lg`, `aspect-video` ou `aspect-square`).

## 6. Anti-padrões e Restrições (O que NÃO fazer)
* Não utilizar "cards dentro de cards dentro de cards" sem necessidade. Usar espaços em branco e divisórias finas de 1px (`divide-y`) para separar conteúdo num mesmo card.
* Evitar gradientes coloridos pesados; os gradientes, quando existirem (ex: banners informativos), devem ser ultra suaves.
* Evitar botões ovais muito longos, manter o padrão de `rounded-lg` ou `rounded-full` (pílula) para os CTAs principais, desde que consistentes.
