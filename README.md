# J.A.R.V.I.S 🤖

> **Just A Rather Very Intelligent System**  
> Assistente virtual inteligente com controle por voz, integração com IA e reprodução de mídia.

---

## 📋 Sobre o Projeto

O **J.A.R.V.I.S** é uma aplicação web desenvolvida em **React + TypeScript**, inspirada no assistente de Tony Stark do universo Marvel. Ele combina reconhecimento de voz, integração com inteligência artificial, busca no Google e controle de mídia via YouTube — tudo em uma interface moderna e responsiva.

---

## ✨ Funcionalidades

- 🎤 **Controle por Voz** — Envie comandos de voz para o assistente processar e responder
- 🤖 **Integração com IA** — Respostas inteligentes via API de IA com fallback de chave de API
- 🔍 **Busca no Google** — Pesquise na web diretamente pela interface do J.A.R.V.I.S
- 🎵 **Player do YouTube** — Reproduza músicas e vídeos com controle de mídia integrado
- 🔊 **Utilitário de Áudio** — Downsampling de áudio para melhor compatibilidade
- ⚡ **Backend Dedicado** — Servidor próprio com tratamento de erros de quota de API
- 🌐 **Deploy na Netlify** — Configurado para SPA routing com `netlify.toml`

---

## 🛠️ Tecnologias

| Tecnologia | Uso |
|---|---|
| React | Interface do usuário |
| TypeScript | Tipagem estática |
| Vite | Bundler e dev server |
| Netlify | Deploy e hosting |
| Web Speech API | Reconhecimento de voz |
| YouTube API | Player e controle de mídia |
| Google Search API | Integração de busca |

---

## 📁 Estrutura do Projeto

```
J.A.R.V.I.S/
├── components/       # Componentes React da interface
├── hooks/            # Custom hooks (conexão com backend, status de API)
├── public/           # Arquivos estáticos
├── server/           # Backend para gerenciamento de APIs
├── src/              # Código fonte principal
├── utils/            # Utilitários (ex: downsampling de áudio)
├── App.tsx           # Componente raiz da aplicação
├── index.html        # Entry point HTML
├── index.tsx         # Entry point React
├── types.ts          # Definições de tipos TypeScript
├── metadata.json     # Metadados do projeto
├── netlify.toml      # Configuração de deploy Netlify
├── vite.config.ts    # Configuração do Vite
└── package.json      # Dependências e scripts
```

---

## 🚀 Como Rodar Localmente

### Pré-requisitos

- [Node.js](https://nodejs.org/) v18+
- npm ou yarn

### Instalação

```bash
# Clone o repositório
git clone https://github.com/guilhermebarcelos06/J.A.R.V.I.S.git

# Entre no diretório
cd J.A.R.V.I.S

# Instale as dependências
npm install
```

### Configuração

Crie um arquivo `.env` na raiz do projeto com suas chaves de API:

```env
VITE_API_KEY=sua_chave_aqui
# Adicione outras variáveis conforme necessário
```

### Rodando

```bash
# Modo desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview da build
npm run preview
```

---


## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

<div align="center">
  Feito com ❤️ por <a href="https://github.com/guilhermebarcelos06">guilhermebarcelos06</a>
</div>
