/**
 * PALAVRAS DO GERADOR — edite à vontade pra mudar o "sabor" dos personagens gerados.
 * Atenção: mudar estas listas muda NOMES e HISTÓRIAS dos gerados (os IDs continuam
 * iguais, então o progresso dos jogadores não se perde).
 *
 * Marcadores de gênero: "{o|a}" vira "o" (masc.) ou "a" (fem.).
 */

export const NICK_M = [
  'Zé', 'Tico', 'Biel', 'Dudu', 'Caio', 'Nando', 'Juca', 'Teco', 'Rafa', 'Léo', 'Pedrinho', 'Gui', 'Neto', 'Toni', 'Beto', 'Vini', 'Lipe', 'Davi',
  'Theo', 'Rui', 'Kadu', 'Paulão', 'Fumaça', 'Tigrão', 'Tonhão', 'Juninho', 'Matheus', 'Enzo', 'Igor', 'Ruan', 'Wesley', 'Luan', 'Ícaro', 'Yuri',
  'Kenji', 'Hugo', 'Otto', 'Bento', 'Raul', 'Joca', 'Murilo', 'Nico', 'Sandro', 'Edu', 'Diogo', 'Cauã', 'Breno', 'Fred', 'Leco', 'Tavinho',
];
export const NICK_F = [
  'Bia', 'Duda', 'Lari', 'Mel', 'Nina', 'Jade', 'Lua', 'Rayssa', 'Kika', 'Tati', 'Babi', 'Gabi', 'Mari', 'Clara', 'Isa', 'Yasmin', 'Lívia', 'Manu',
  'Sofia', 'Ayla', 'Bruna', 'Dandara', 'Keyla', 'Jéssica', 'Pietra', 'Malu', 'Tainá', 'Íris', 'Cora', 'Vivi', 'Lola', 'Nanda', 'Rosa', 'Zoe',
  'Yumi', 'Aiko', 'Helô', 'Luna', 'Carol', 'Bela', 'Dani', 'Fê', 'Gigi', 'Joana', 'Kiara', 'Lis', 'Maya', 'Olívia', 'Pâmela', 'Quésia',
];

/** Sobrenomes de rua (apelidos) — combinam com qualquer gênero. */
export const STREET = [
  'Caveira', 'Fumaça', 'Ferrugem', 'Neon', 'Trovão', 'Sombra', 'Vácuo', 'Pimenta', 'Cinza', 'Breu', 'Lâmina', 'Faísca', 'Graxa', 'Vidro', 'Sucata',
  'Cripta', 'Ossada', 'Asfalto', 'Concreto', 'Bueiro', 'Viela', 'Laje', 'Marquise', 'Fliperama', 'Grafite', 'Batuque', 'Pólvora', 'Chumbo', 'Ácido',
  'Garoa', 'Relâmpago', 'Ciclone', 'Granizo', 'Brasa', 'Cometa', 'Eclipse', 'Abismo', 'Pixel', 'Glitch', 'Beat', 'Grave', 'Agudo', 'Volt', 'Turbo',
  'Rajada', 'Estilingue', 'Navalha', 'Alicate', 'Martelo', 'Parafuso', 'Bigorna', 'Correia', 'Catraca', 'Sinal', 'Antena', 'Radar', 'Sirene', 'Marreco',
  'Coruja', 'Corvo', 'Gato', 'Lobo', 'Tubarão', 'Serpente', 'Escorpião', 'Morcego', 'Urubu', 'Hiena', 'Pantera', 'Falcão', 'Vespa', 'Aranha', 'Jabuti',
  'Pitbull', 'Caramelo', 'Chiclete', 'Paçoca', 'Pirulito', 'Pipoca', 'Rapadura', 'Café', 'Guaraná', 'Açaí', 'Tapioca', 'Coxinha', 'Pastel', 'Quindim',
];

export const PREFIX = ['MC', 'DJ', 'Lil', 'Big', 'Dona', 'Seu', 'Mestre', 'Doutor', 'Capitão', 'Tia', 'Tio', 'Mano', 'Mina', 'Professor', 'Sargento', 'Baby', 'Don', 'Madame'];
export const PREFIX_GENDERED: Record<string, 'm' | 'f' | 'x'> = {
  MC: 'x', DJ: 'x', Lil: 'x', Big: 'x', Dona: 'f', Seu: 'm', Mestre: 'x', Doutor: 'm', Capitão: 'm', Tia: 'f', Tio: 'm', Mano: 'm', Mina: 'f', Professor: 'm', Sargento: 'x', Baby: 'x', Don: 'm', Madame: 'f',
};

export const ROBOT_CODES = ['RX', 'TK', 'ZX', 'MK', 'B0', 'V9', 'Q7', 'NX', 'D4', 'K2', 'XR', 'T-800', 'AL', 'OM', 'GR'];
export const ALIEN_SYL = ['zor', 'kal', 'vex', 'tri', 'nub', 'qua', 'xil', 'mor', 'plo', 'zee', 'gak', 'yun', 'ora', 'thi', 'lux', 'bri', 'kwo', 'ix'];

export const TITLE_NOUN_M = ['Fantasma', 'Rei', 'Lobo', 'Guardião', 'Mestre', 'Diabo', 'Profeta', 'Barão', 'Andarilho', 'Coveiro', 'Vigia', 'Carrasco', 'Poeta', 'Mecânico', 'Caçador', 'Pirata', 'Monge', 'Rato', 'Bicho', 'Corvo'];
export const TITLE_NOUN_F = ['Rainha', 'Loba', 'Guardiã', 'Mestra', 'Diaba', 'Profetisa', 'Baronesa', 'Andarilha', 'Coveira', 'Vigia', 'Bruxa', 'Poeta', 'Mecânica', 'Caçadora', 'Pirata', 'Monja', 'Fera', 'Dama', 'Sereia', 'Coruja'];
export const TITLE_OF = [
  'do Beco 13', 'da Laje Alta', 'do Porto Ferrugem', 'do Cemitério Velho', 'da Torre Neon', 'do Viaduto', 'da Vila Fantasma', 'do Shopping Abandonado',
  'da Estação Fim da Linha', 'do Morro do Osso', 'do Distrito Neon', 'das Galerias', 'da Fábrica de Ossos', 'do Lixão Estelar', 'da Ponte Quebrada',
  'do Fliperama', 'da Feira Noturna', 'do Terminal 0', 'da Avenida Calor', 'da Serra Branca', 'do Vazio', 'da Última Quadra', 'do Mercado de Pulgas',
];

export const DISTRICTS = [
  'Beco 13, Necrópolis Baixa', 'Laje Alta, Morro do Osso', 'Porto Ferrugem', 'Cemitério Velho', 'Torre Neon, Distrito Neon', 'Viaduto da Saudade',
  'Vila Fantasma', 'Shopping Abandonado', 'Estação Fim da Linha', 'Galerias de Esgoto', 'Fábrica de Ossos', 'Ponte Quebrada', 'Feira Noturna',
  'Terminal 0', 'Avenida Calor', 'Conjunto Habitacional Caveirão', 'Rua dos Varais', 'Praça do Relógio Parado', 'Mercado de Pulgas', 'Escola Municipal Assombrada',
];
export const PLANETS = ['Lua Kr-7', 'Nebulosa Estática', 'Planeta Gelatina', 'Anel de Saturnino', 'Sistema Zorblax', 'Cometa Pirulito', 'Galáxia Fliperama', 'Asteroide 404'];
export const UNDERWORLDS = ['o Inferno (setor de reclamações)', 'o Sétimo Subsolo', 'a Caldeira Central', 'o Purgatório de Espera', 'o Inferno Gelado do Norte'];

// ---------------------------------------------------------------------------
// HISTÓRIA — fragmentos por espécie
// ---------------------------------------------------------------------------

export const CHILDHOOD = [
  'entre varais, escadas de incêndio e o barulho eterno dos letreiros',
  'dormindo em cima da oficina do avô, cercad{o|a} de peças que nunca serviam pra nada',
  'na última casa antes do lixão, onde aprendeu a transformar sucata em brinquedo',
  'num prédio sem elevador, subindo 14 andares por dia com sacolas de feira',
  'vendendo bala no sinal e decorando o rosto de cada motorista',
  'no fundo de uma lanchonete 24h, ouvindo as histórias dos clientes da madrugada',
  'numa família enorme, onde quem chegava por último na mesa ficava sem comer',
  'ajudando a mãe a costurar fantasias pro carnaval dos mortos',
  'entre as quadras de futebol de várzea e as brigas que sempre vinham depois',
  'pulando muros da escola pra assistir às lutas clandestinas no galpão',
  'cuidando de um pombo-correio que levava recados pros vizinhos',
  'em cima de uma banca de discos, com fone no ouvido 20 horas por dia',
];

export const EVENT_HUMAN = [
  'Aos {n} anos, salvou um vizinho de um incêndio e descobriu que não sentia medo de nada — o que é bem diferente de ser corajos{o|a}.',
  'Aos {n}, perdeu tudo numa aposta da Gangue da Ferrugem e jurou que nunca mais ia perder pra ninguém.',
  'Aos {n}, ganhou um campeonato de fliperama sem dinheiro pra comprar a ficha final: jogou com a ficha que achou no bueiro.',
  'Aos {n}, ficou preso num apagão de três dias no metrô e saiu de lá enxergando no escuro (ou pelo menos é o que conta).',
  'Aos {n}, foi expuls{o|a} de três escolas no mesmo ano — uma delas por consertar o sistema de som e tocar funk na formatura.',
  'Aos {n}, encontrou uma moeda da morte no meio da rua e, desde então, a sorte nunca mais foi a mesma.',
  'Aos {n}, treinou sozinh{o|a} todas as noites num terreno baldio, lutando contra a própria sombra até a sombra desistir.',
  'Aos {n}, defendeu a feira do bairro de um cobrador da máfia e virou lenda da noite pro dia.',
];

export const DEATH = [
  'escorregando numa casca de banana no topo da Torre Neon',
  'tentando bater o recorde de cachorros-quentes da Feira Noturna',
  'num duelo de violão que durou três dias seguidos',
  'esperando o ônibus da linha 13, que nunca passou',
  'rindo de uma piada tão boa que esqueceu de respirar',
  'defendendo a rua inteira de uma invasão de ratos gigantes',
  'tentando pular de um prédio pro outro com um guarda-chuva',
  'no meio de uma briga de bar por causa do último pastel',
  'desafiando um raio pra ver quem era mais rápido',
  'dormindo num caixão em promoção da funerária, só pra testar o conforto',
];

export const ROBOT_JOB = [
  'pra varrer as ruas do Distrito Neon', 'pra cuidar das crianças de uma creche automática', 'pra servir café numa estação de metrô',
  'pra vigiar o cofre do Banco dos Mortos', 'pra montar outros robôs na Fábrica de Ossos', 'pra dirigir o bondinho do Morro do Osso',
  'pra limpar as janelas da Torre Neon', 'pra entregar pizza em menos de 13 minutos', 'pra apresentar o jornal da madrugada', 'pra ser segurança de baile',
];

export const ROBOT_TWIST = [
  'até um raio cair na antena e {ele|ela} ganhar consciência — e opinião sobre tudo',
  'até a empresa falir e mandar todo mundo pro ferro-velho; {ele|ela} se recusou a ser desligad{o|a}',
  'até perceber que ninguém nunca tinha dito "obrigado" e decidir que merecia mais',
  'até ser hackead{o|a} por um adolescente que esqueceu de desfazer o hack',
  'até baixar sem querer todos os filmes de luta da internet numa noite só',
];

export const ALIEN_ARRIVAL = [
  'quando a nave de turismo bateu no para-raios da Torre Neon',
  'por engano: digitou "Necrópolis" em vez de "Netuno" no GPS',
  'fugindo de uma prova de recuperação na escola do planeta natal',
  'num meteoro alugado, atrás do sinal de rádio da Laje Alta',
  'em busca do famoso pastel de queijo da Feira Noturna',
  'teletransportad{o|a} durante uma partida online que caiu',
];

export const DEMON_REASON = [
  'foi expuls{o|a} do Inferno por ser gentil demais com as almas da fila',
  'pediu demissão do Inferno depois de 400 anos sem férias',
  'perdeu uma aposta com um anjo e foi obrigad{o|a} a morar na superfície',
  'subiu pela tubulação da Avenida Calor procurando ar-condicionado',
  'foi mandad{o|a} pra Terra como estagiári{o|a} e nunca mais voltou',
];

export const GHOST_HAUNT = ['o Fliperama Estrela Cadente', 'a Escola Municipal Assombrada', 'o Shopping Abandonado', 'a Estação Fim da Linha', 'o Hotel Último Andar', 'a biblioteca do Cemitério Velho', 'um karaokê falido da Vila Fantasma'];

export const ARENA_REASON = [
  'pra pagar a reforma da casa da mãe',
  'pra recuperar algo que a Gangue da Ferrugem roubou',
  'porque ouviu que lá dá pra ficar famos{o|a} em uma noite',
  'pra provar pra família que não era só uma fase',
  'pra bancar o tratamento do irmão mais novo',
  'porque perdeu uma aposta e ficou com vergonha de não ir',
  'pra juntar Moedas da Morte e comprar um terreno no Morro do Osso',
  'atrás de um rival que sumiu dentro da arena',
  'porque foi a única porta aberta numa noite de chuva',
  'pra descobrir quem escreveu o código da caveira que ri',
  'pra conseguir Isvoid e consertar o portal de casa',
  'porque o bairro inteiro fez vaquinha pra pagar a inscrição',
];

export const PERSONALITY = [
  'Fala pouco e sorri menos ainda, mas nunca abandona um aliado.',
  'Não para de falar nem durante a luta — inclusive narra os próprios golpes.',
  'Tem um código de honra estranho: nunca ataca pelas costas, mas adora provocar.',
  'É educad{o|a} até demais: pede desculpa depois de cada eliminação.',
  'Vive com fome e negocia lanche como pagamento de qualquer favor.',
  'Coleciona os bonés dos adversários derrotados e dá nome pra cada um.',
  'Ri alto em toda situação, principalmente nas piores.',
  'Treina todo dia às 5h da manhã e acha que todo mundo deveria fazer o mesmo.',
  'É supersticios{o|a}: entra na arena sempre com o pé esquerdo e um chiclete na boca.',
  'Parece preguiços{o|a}, mas lê o mapa melhor que qualquer um.',
  'Tem medo de altura, de barata e de nada mais.',
  'Leva tudo pro lado pessoal — inclusive derrota pra bot.',
];

export const STYLE_BY_ROLE: Record<string, string[]> = {
  atacante: ['Na arena, mantém a distância certa e não para de atirar.', 'Joga em movimento constante, trocando tiro sem dar folga.', 'Prefere pressionar o tempo todo e nunca deixar o inimigo respirar.'],
  tanque: ['Na arena, segura a linha de frente e abre espaço pro time passar.', 'Usa o próprio corpo como muralha e adora quebrar paredes.', 'Avança devagar, aguenta tudo e esmaga quem fica no caminho.'],
  suporte: ['Na arena, é quem mantém o time de pé quando tudo dá errado.', 'Cura, protege e só ataca quando um aliado está em perigo.', 'Fica atrás da linha, de olho na vida de cada aliado.'],
  assassino: ['Na arena, some no arbusto e aparece colad{o|a} em quem está sozinho.', 'Caça os mais frágeis e foge antes do revide chegar.', 'Entra rápido, acaba rápido e desaparece mais rápido ainda.'],
  atirador: ['Na arena, procura o ponto mais longe e espera o erro do adversário.', 'Um tiro, uma decisão: paciência é a arma principal.', 'Pune quem anda em linha reta pelo meio do mapa.'],
  controle: ['Na arena, transforma o chão num campo minado de efeitos.', 'Prende, desacelera e bagunça a formação inimiga.', 'Decide por onde o inimigo pode andar — e por onde não pode.'],
  lancador: ['Na arena, arremessa por cima das paredes e expulsa quem se esconde.', 'Não precisa ver o inimigo: só precisa saber onde ele está.', 'Transforma qualquer esconderijo numa armadilha.'],
};

export const DREAMS = [
  'Comprar a laje mais alta do Morro do Osso e fazer um churrasco eterno.',
  'Ver o próprio nome no topo do ranking da arena por um dia inteiro.',
  'Abrir uma loja de discos que funcione só de madrugada.',
  'Reencontrar alguém que sumiu numa noite de neblina.',
  'Viajar até o mar — nunca viu o mar de verdade.',
  'Derrotar um CREATOR sem usar nenhuma habilidade.',
  'Ter um pet que não fuja na primeira explosão.',
  'Construir uma rampa que dê a volta na Torre Neon.',
  'Escrever um livro sobre as lendas da arena.',
  'Ganhar o suficiente pra nunca mais pegar fila no metrô.',
  'Pintar a lua-caveira de outra cor.',
  'Abrir uma escola de luta pras crianças do bairro.',
];

export const FEARS = [
  'Silêncio total.', 'Palhaços (mesmo os mortos).', 'Ficar sem bateria no celular.', 'Água parada.', 'Ser esquecid{o|a}.', 'Escuro de verdade.',
  'Pombos. Muitos pombos.', 'Fila de banco.', 'Perder o boné favorito.', 'A risada da caveira de pixel.', 'Elevador lotado.', 'Altura.', 'Gente que mastiga de boca aberta.',
];

export const TRIVIA = [
  'Sabe de cor a letra de todas as músicas da Laje Alta.',
  'Já foi expuls{o|a} da Feira Noturna por comer demais no rodízio de pastel.',
  'Dorme de tênis, "pra caso precise correr".',
  'Tem uma tatuagem que só aparece no escuro.',
  'Nunca perdeu uma partida de dominó.',
  'Já tentou adotar um morcego. O morcego adotou {ele|ela}.',
  'Tem 3 celulares e nenhum funciona direito.',
  'Coleciona chaveiros de lugares que nunca visitou.',
  'É ótim{o|a} cozinheir{o|a}, mas só faz miojo.',
  'Conversa com as plantas — e jura que elas respondem.',
  'Tem um apelido secreto que só a avó usa.',
  'Já ganhou um concurso de dança sem saber que estava participando.',
  'Guarda a primeira Moeda da Morte que ganhou num cordão.',
  'Assiste a todas as partidas gravadas antes de dormir.',
];
