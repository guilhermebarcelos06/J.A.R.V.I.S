J.A.R.V.I.S. - Just A Rather Very Intelligent System

Este projeto é uma interface de assistente virtual inspirada no JARVIS do Iron Man. Desenvolvido com React e TypeScript, o J.A.R.V.I.S. oferece uma experiência imersiva com componentes futuristas, animações e funcionalidades de interação inteligentes.

🚀 Funcionalidades

• Interface Futurista: Design inspirado nos ecrãs da Stark Industries com componentes estilizados.
• Arc Reactor: Componente visual animado que representa o núcleo de energia do Jarvis.
• Chat Inteligente: Interface de conversação fluida com suporte para processamento de comandos.
• Interação por Voz: Utilização de audioUtils para feedback sonoro e processamento de áudio.
• Player de YouTube: Integração para reprodução de conteúdos multimédia diretamente na interface.
• Sistema de Login: Ecrã de autenticação temático para acesso ao sistema.


🛠️ Tecnologias Utilizadas

Frontend: React, TypeScript
Build Tool: Vite
Estilização: Tailwind CSS
Backend: Node.js (Express)
Gestão de Estado: Hooks Personalizados


🧠 Hooks Personalizados

// useJarvis: Lógica principal de comportamento e cérebro do assistente.
// useChat: Gestão de estado, histórico de mensagens e fluxo de conversação.


📦 Estrutura do Projeto

├── src/
│   ├── components/       # Componentes visuais (ArcReactor, Chat, YouTubePlayer, etc.)
│   ├── hooks/            # Lógica de estado reutilizável
│   ├── utils/            # Utilitários de áudio e funções de suporte
│   ├── App.tsx           # Componente principal
│   └── types.ts          # Definições de tipos TypeScript
├── server/               # Lógica de backend em Node.js
└── public/               # Ativos estáticos e redirecionamentos


🔧 Instalação e Execução

Clonar o repositório:

git clone [https://github.com/guilhermebarcelos06/j.a.r.v.i.s.git](https://github.com/guilhermebarcelos06/j.a.r.v.i.s.git)


Instalar dependências:

npm install


Iniciar o servidor de desenvolvimento:

npm run dev


Configurar o Servidor (opcional):

cd server && npm install && npm start


🛡️ Licença

Este projeto foi desenvolvido para fins de estudo e entretenimento. 
Todos os direitos de imagem e marca "JARVIS / Iron Man" pertencem à Marvel/Disney.


Desenvolvido por Guilherme Barcelos
