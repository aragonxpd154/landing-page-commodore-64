/* =========================================================================
 *  content.js — Textos exibidos no terminal (SOBRE, HARDWARE, HISTORIA)
 *  e os programas do "disquete" (LOAD"$",8)
 *  ---------------------------------------------------------------------
 *  Para personalizar, edite o objeto PERFIL logo abaixo.
 *  Marcações de cor: {wht} {red} {cyn} {pur} {grn} {blu} {yel} {org}
 *  {brn} {lrd} {gr1} {gr2} {lgn} {lbl} {gr3} {blk}  e  {rvs} / {off}
 *  Cada linha deve ter no máximo 39 caracteres visíveis.
 * ========================================================================= */
'use strict';

const PERFIL = {
  nome: 'Marcos Silva dos Santos',
  assinatura: 'Marcos Santos',
  resumo: [
    'Radialista e técnico em transmissão',
    'de rádio e TV em Vitória/ES.'
  ],
  funcao: [
    'Supervisor de Distribuição e Entrega',
    'de Sinais na Rede Gazeta.'
  ],
  areas: [
    'TV digital ISDB-T e redes SFN',
    'RF, enlaces de micro-ondas e STM-1',
    'Redes IP, SNMP e telemetria',
    'Linux, automação e monitoramento',
    'Eletrônica digital e retrocomputação'
  ],
  projetos: [
    ['ISDBT-ANALYZER', 'previsor ISDB-T'],
    ['SYS-RID', 'software da equipe'],
    ['8-BITS-COMPUTER', 'CPU em lógica TTL'],
    ['LANDING-PAGE-ATARI', 'tributo ao VCS 2600'],
    ['LANDING-PAGE-C64', 'este simulador']
  ],
  publicacao: [
    'Falha sistêmica em rede SFN por',
    'instabilidade STP/IGMP em',
    'radiodifusão digital terrestre (2026)'
  ],
  github: 'https://github.com/aragonxpd154',
  linkedin: 'https://www.linkedin.com/in/marcosobel'
};

/* ---------- utilitários de layout ---------- */
const visLen = (s) => s.replace(/\{[a-z0-9]+\}/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '').length;
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - visLen(s)));
const bar = (text, color = 'wht') => `{rvs}{${color}}` + pad(' ' + text, 39) + '{off}';
const rule = (color = 'gr2') => `{${color}}` + '─'.repeat(39);
const shortUrl = (u) => u.replace(/^https?:\/\/(www\.)?/, '').toUpperCase();

/* ---------- SOBRE / HELP ---------- */
function pageSobre() {
  const L = [];
  L.push(bar('SOBRE MIM', 'yel'));
  L.push('');
  L.push('{wht}' + PERFIL.nome.toUpperCase());
  PERFIL.resumo.forEach((s) => L.push('{lbl}' + s));
  L.push('');
  L.push('{cyn}FUNÇÃO');
  PERFIL.funcao.forEach((s) => L.push('{lbl}' + s));
  L.push('');
  L.push('{cyn}ÁREAS DE ATUAÇÃO');
  PERFIL.areas.forEach((s) => L.push('{yel}♦ {lbl}' + s));
  L.push('');
  L.push('{cyn}PROJETOS NO GITHUB');
  PERFIL.projetos.forEach(([n, d]) => L.push('{wht}' + pad(n, 19) + '{gr3}' + d));
  L.push('');
  L.push('{cyn}PUBLICAÇÃO');
  PERFIL.publicacao.forEach((s) => L.push('{lbl}' + s));
  L.push('');
  L.push('{cyn}CONTATO');
  L.push('{lgn}' + shortUrl(PERFIL.github));
  L.push('{lgn}' + shortUrl(PERFIL.linkedin));
  L.push('{gr3}(DIGITE GITHUB OU LINKEDIN PARA ABRIR)');
  L.push('');
  return L.concat(pageComandos());
}

function pageComandos() {
  return [
    bar('COMANDOS', 'cyn'),
    '',
    '{wht}HELP {gr3}ou {wht}SOBRE   {lbl}quem fez este projeto',
    '{wht}HARDWARE        {lbl}eletrônica do C64',
    '{wht}HARDWARE CPU    {lbl}uma seção (veja abaixo)',
    '{wht}HISTORIA        {lbl}a história do C64',
    '{wht}COMANDOS        {lbl}esta lista',
    '{wht}LOAD"$",8       {lbl}diretório do disquete',
    '{wht}LOAD"MAZE",8    {lbl}carrega um programa',
    '{wht}LIST {gr3}/ {wht}RUN      {lbl}lista / executa',
    '{wht}SAVE"NOME",8    {lbl}grava no navegador',
    '{wht}POKE 53280,0    {lbl}cor da borda (0-15)',
    '{wht}POKE 53281,0    {lbl}cor do fundo',
    '{wht}TURBO           {lbl}liga/desliga 25x',
    '{wht}SYS 64738       {lbl}reset',
    '',
    '{gr3}SEÇÕES: VISAO DIAGRAMA CPU VIC SID',
    '{gr3}CIA MEMORIA MAPA PLA CLOCK ENERGIA',
    '{gr3}PORTAS PLACA',
    '',
    '{gr3}TECLAS: ESC=RUN/STOP  HOME/END=CLR',
    '{gr3}CTRL+1..8 E ALT+1..8 = CORES',
    '{gr3}CTRL+9/0 = RVS ON/OFF'
  ];
}

/* ---------- HARDWARE ---------- */
const HW = {};

HW.VISAO = () => [
  bar('COMMODORE 64 - VISÃO GERAL', 'yel'),
  '',
  '{wht}LANÇAMENTO  {lbl}agosto de 1982 (US$ 595)',
  '{wht}CPU         {lbl}MOS 6510 a ~1 MHz',
  '{wht}VÍDEO       {lbl}VIC-II 6567/6569',
  '{wht}SOM         {lbl}SID 6581 (3 vozes)',
  '{wht}E/S         {lbl}2x CIA 6526',
  '{wht}RAM         {lbl}64 KB DRAM + 1 KB cor',
  '{wht}ROM         {lbl}20 KB (BASIC/KERNAL/CHAR)',
  '{wht}TELA        {lbl}40x25 texto, 320x200',
  '{wht}CORES       {lbl}16 fixas',
  '{wht}SPRITES     {lbl}8 de 24x21 pixels',
  '{wht}TECLADO     {lbl}66 teclas, matriz 8x8',
  '{wht}ALIMENTAÇÃO {lbl}5 V DC + 9 V AC externa',
  '',
  '{gr3}O número 38911 BASIC BYTES FREE é o',
  '{gr3}espaço entre $0801 e $9FFF, que fica',
  '{gr3}livre para programas em BASIC.',
  ''
];

HW.DIAGRAMA = () => [
  bar('DIAGRAMA DE BLOCOS', 'yel'),
  '',
  '{lrd} ┌──────┐{cyn} ┌──────┐{lgn} ┌──────┐{yel} ┌──────┐',
  '{lrd} │ 6510 │{cyn} │VIC-II│{lgn} │ SID  │{yel} │ CIA  │',
  '{lrd} │ CPU  │{cyn} │ 6569 │{lgn} │ 6581 │{yel} │2x6526│',
  '{lrd} └──┬───┘{cyn} └──┬───┘{lgn} └──┬───┘{yel} └──┬───┘',
  '{yel}────┼────────┼────────┼────────┼──────',
  '{yel} BARRAMENTO: 16 BITS END. / 8 DADOS',
  '{yel}────┼────────┼────────┼────────┼──────',
  '{gr3} ┌──┴───┐{wht} ┌──┴───┐{cyn} ┌──┴───┐{lrd} ┌──┴───┐',
  '{gr3} │ 64KB │{wht} │ ROMS │{cyn} │ PLA  │{lrd} │ COR  │',
  '{gr3} │ DRAM │{wht} │ 20KB │{cyn} │906114│{lrd} │RAM 1K│',
  '{gr3} └──────┘{wht} └──────┘{cyn} └──────┘{lrd} └──────┘',
  '',
  '{lbl}CPU e VIC-II dividem o mesmo',
  '{lbl}barramento: em cada ciclo de clock o',
  '{lbl}VIC-II usa a fase baixa e a CPU a',
  '{lbl}fase alta do clock. A PLA decide',
  '{lbl}quem responde a cada endereço.',
  ''
];

HW.CPU = () => [
  bar('CPU - MOS 6510', 'lrd'),
  '',
  '{wht}Núcleo 6502 de 8 bits, NMOS, 40 pinos.',
  '{lbl}PAL: 0,985 MHz   NTSC: 1,023 MHz',
  '{lbl}Barramento de endereços de 16 bits',
  '{lbl}(64 KB) e de dados de 8 bits.',
  '',
  '{cyn}REGISTRADORES',
  '{lbl}A (acumulador), X, Y, SP (pilha em',
  '{lbl}$0100-$01FF), PC de 16 bits e P',
  '{lbl}(flags N V - B D I Z C).',
  '',
  '{cyn}O QUE O 6510 TEM A MAIS',
  '{lbl}Porta de E/S de 6 bits embutida:',
  '{wht}$0000 {lbl}direção  {wht}$0001 {lbl}dados',
  '{lbl}bit 0 LORAM  - BASIC ROM ou RAM',
  '{lbl}bit 1 HIRAM  - KERNAL ROM ou RAM',
  '{lbl}bit 2 CHAREN - E/S ou ROM de chars',
  '{lbl}bits 3-5     - datasette (motor,',
  '{lbl}               escrita e sensor)',
  '',
  '{lbl}Pinos AEC e RDY permitem que o VIC-II',
  '{lbl}"pare" a CPU para ler a memória.',
  ''
];

HW.VIC = () => [
  bar('VÍDEO - VIC-II', 'cyn'),
  '',
  '{wht}MOS 6567 (NTSC) / 6569 (PAL)',
  '{lbl}Projetado por Al Charpentier.',
  '{lbl}47 registradores em $D000-$D02E.',
  '',
  '{cyn}MODOS',
  '{lbl}Texto 40x25 (caracteres 8x8)',
  '{lbl}Bitmap 320x200 (2 cores por célula)',
  '{lbl}Multicolor 160x200 (4 cores/célula)',
  '{lbl}Texto com cor de fundo estendida',
  '',
  '{cyn}SPRITES',
  '{lbl}8 sprites de 24x21 (ou 12x21 multi-',
  '{lbl}cor), expansão 2x, prioridade e',
  '{lbl}detecção de colisão por hardware.',
  '',
  '{cyn}TEMPORIZAÇÃO',
  '{lbl}PAL: 312 linhas x 63 ciclos',
  '{lbl}NTSC: 263 linhas x 65 ciclos',
  '{lbl}Interrupção por linha de raster,',
  '{lbl}rolagem fina de 0 a 7 pixels.',
  '',
  '{lbl}A cada 8 linhas ("badline") o VIC',
  '{lbl}rouba 40 ciclos da CPU para ler os',
  '{lbl}códigos de tela. Ele também gera o',
  '{lbl}refresh e os sinais RAS/CAS da DRAM',
  '{lbl}e enxerga 16 KB de cada vez.',
  ''
];

HW.SID = () => [
  bar('SOM - SID 6581', 'lgn'),
  '',
  '{wht}Sound Interface Device',
  '{lbl}Projetado por Bob Yannes. Registros',
  '{lbl}em $D400-$D41C (54272-54300).',
  '',
  '{cyn}3 VOZES INDEPENDENTES',
  '{lbl}Frequência de 16 bits (0 a ~4 kHz)',
  '{lbl}Ondas: triângulo, dente-de-serra,',
  '{lbl}pulso (largura de 12 bits) e ruído',
  '{lbl}Envelope ADSR por voz',
  '{lbl}Ring modulation e sincronismo',
  '',
  '{cyn}FILTRO ANALÓGICO',
  '{lbl}Passa-baixa, passa-banda e passa-',
  '{lbl}alta (combináveis), corte de 11',
  '{lbl}bits e ressonância de 4 bits.',
  '',
  '{cyn}EXTRAS',
  '{lbl}2 conversores A/D para paddles',
  '{lbl}Leitura do oscilador 3 (ótimo',
  '{lbl}gerador de números aleatórios)',
  '',
  '{lbl}O 6581 usa 12 V; o 8580 (C64C)',
  '{lbl}usa 9 V e soa um pouco diferente.',
  '{gr3}Experimente: LOAD"MUSICA",8 e RUN',
  ''
];

HW.CIA = () => [
  bar('E/S - 2x CIA 6526', 'lgn'),
  '',
  '{wht}Complex Interface Adapter',
  '{lbl}Cada CIA tem 2 portas de 8 bits,',
  '{lbl}2 timers de 16 bits, relógio TOD',
  '{lbl}(BCD, com alarme) e registrador',
  '{lbl}de deslocamento serial.',
  '',
  '{cyn}CIA 1 - $DC00 (56320)',
  '{lbl}Varre a matriz do teclado 8x8',
  '{lbl}Lê os joysticks (portas 1 e 2)',
  '{lbl}Gera a IRQ de 60 Hz do KERNAL',
  '{lbl}(cursor, teclado e relógio TI)',
  '',
  '{cyn}CIA 2 - $DD00 (56576)',
  '{lbl}Barramento serial IEC (drive 1541',
  '{lbl}e impressora): ATN, CLK e DATA',
  '{lbl}Seleciona o banco de 16 KB do VIC',
  '{lbl}User port e RS-232 por software',
  '{lbl}Ligado à linha NMI da CPU',
  '',
  '{gr3}A tecla RESTORE não passa pelo CIA:',
  '{gr3}vai direto à NMI por um timer 556.',
  ''
];

HW.MEMORIA = () => [
  bar('MEMÓRIA', 'gr3'),
  '',
  '{cyn}RAM DINÂMICA - 64 KB',
  '{lbl}Placas antigas: 8x 4164 (64Kx1)',
  '{lbl}Placas novas: 2x 41464 (64Kx4)',
  '{lbl}Endereços multiplexados por',
  '{lbl}74LS257 (linha/coluna).',
  '',
  '{cyn}COLOR RAM - 1 KB x 4 BITS',
  '{lbl}SRAM 2114 em $D800-$DBE7. Guarda a',
  '{lbl}cor de cada caractere da tela.',
  '',
  '{cyn}ROMS - 20 KB',
  '{wht}BASIC V2   {lbl}8 KB  $A000  901226-01',
  '{wht}KERNAL     {lbl}8 KB  $E000  901227-0x',
  '{wht}CHARACTER  {lbl}4 KB  $D000  901225-01',
  '',
  '{lbl}Nas placas finais BASIC e KERNAL',
  '{lbl}foram unidos em uma ROM de 16 KB',
  '{lbl}(251913-01).',
  '',
  '{lbl}Com bank switching a CPU enxerga',
  '{lbl}os 64 KB de RAM inteiros, mesmo',
  '{lbl}com as ROMs "por cima".',
  ''
];

HW.MAPA = () => [
  bar('MAPA DE MEMÓRIA', 'gr3'),
  '',
  '{wht}$0000-$00FF {lbl}página zero',
  '{wht}$0100-$01FF {lbl}pilha da CPU',
  '{wht}$0200-$03FF {lbl}área do BASIC/KERNAL',
  '{wht}$0400-$07E7 {lbl}tela (1000 bytes)',
  '{wht}$07F8-$07FF {lbl}ponteiros de sprites',
  '{wht}$0801-$9FFF {lbl}programa BASIC',
  '{wht}$A000-$BFFF {lbl}BASIC ROM / RAM',
  '{wht}$C000-$CFFF {lbl}4 KB de RAM livre',
  '{wht}$D000-$D3FF {lbl}VIC-II',
  '{wht}$D400-$D7FF {lbl}SID',
  '{wht}$D800-$DBFF {lbl}Color RAM',
  '{wht}$DC00-$DCFF {lbl}CIA 1',
  '{wht}$DD00-$DDFF {lbl}CIA 2',
  '{wht}$DE00-$DFFF {lbl}E/S 1 e 2 (cartucho)',
  '{wht}$E000-$FFFF {lbl}KERNAL ROM / RAM',
  '',
  '{cyn}VETORES DA CPU',
  '{wht}$FFFA {lbl}NMI  {wht}$FFFC {lbl}RESET  {wht}$FFFE {lbl}IRQ',
  '',
  '{cyn}ENDEREÇOS FAMOSOS',
  '{wht}53280 {lbl}cor da borda',
  '{wht}53281 {lbl}cor do fundo',
  '{wht}646   {lbl}cor do cursor',
  '{wht}1024  {lbl}início da tela',
  '{wht}55296 {lbl}início da Color RAM',
  '{wht}64738 {lbl}rotina de RESET (SYS)',
  ''
];

HW.PLA = () => [
  bar('PLA - LÓGICA DE ENDEREÇOS', 'lrd'),
  '',
  '{wht}PLA 906114-01 (82S100)',
  '{lbl}Programmable Logic Array que gera',
  '{lbl}os "chip selects" do sistema.',
  '',
  '{lbl}Entradas: endereços A12-A15, os',
  '{lbl}bits LORAM/HIRAM/CHAREN do 6510,',
  '{lbl}as linhas GAME e EXROM do cartucho',
  '{lbl}e sinais do VIC-II.',
  '',
  '{lbl}Saídas: habilita RAM, BASIC,',
  '{lbl}KERNAL, CHAR ROM, E/S, ROML e ROMH.',
  '',
  '{cyn}LÓGICA DE APOIO (TTL / CMOS)',
  '{lbl}74LS257 multiplexam a DRAM',
  '{lbl}74LS139 decodifica a área de E/S',
  '{lbl}74LS373 trava endereços do VIC',
  '{lbl}4066 chaveia os paddles',
  '{lbl}7406 aciona o barramento IEC',
  '{lbl}556 debounce do RESTORE',
  ''
];

HW.CLOCK = () => [
  bar('CLOCK', 'lbl'),
  '',
  '{cyn}CRISTAIS',
  '{wht}PAL  {lbl}17,734472 MHz (4x subport.)',
  '{wht}NTSC {lbl}14,31818 MHz',
  '',
  '{lbl}O VIC-II gera o dot clock (7,88 MHz',
  '{lbl}PAL / 8,18 MHz NTSC) e divide por 8',
  '{lbl}para obter o clock da CPU (PHI0):',
  '',
  '{wht}PAL  {lbl}17,734472 / 18 = 0,985 MHz',
  '{wht}NTSC {lbl}14,31818 / 14 = 1,023 MHz',
  '',
  '{lbl}Nas revisões posteriores o circuito',
  '{lbl}de clock passou a ser o MOS 8701.',
  '',
  '{lbl}O relógio TOD dos CIAs usa a rede',
  '{lbl}elétrica (50/60 Hz) que chega pelos',
  '{lbl}9 V AC da fonte.',
  ''
];

HW.ENERGIA = () => [
  bar('ALIMENTAÇÃO', 'yel'),
  '',
  '{lbl}Fonte externa ("tijolo") com duas',
  '{lbl}saídas:',
  '{wht}+5 V DC {lbl}~1,5 A  lógica digital',
  '{wht}9 V AC  {lbl}~1 A',
  '',
  '{cyn}DENTRO DA PLACA',
  '{lbl}9 V AC -> ponte retificadora ->',
  '{lbl}regulador 7812 = +12 V para o',
  '{lbl}VIC-II e o SID 6581.',
  '{lbl}9 V AC também vai à user port e',
  '{lbl}gera os 50/60 Hz do relógio TOD.',
  '',
  '{lrd}CUIDADO: {lbl}as fontes originais',
  '{lbl}envelhecem e podem subir os 5 V,',
  '{lbl}queimando RAM, PLA e CPU. Use',
  '{lbl}protetor de sobretensão.',
  ''
];

HW.PORTAS = () => [
  bar('CONECTORES', 'lgn'),
  '',
  '{wht}EXPANSÃO    {lbl}44 pinos, cartuchos',
  '{wht}USER PORT   {lbl}24 pinos, E/S paralela',
  '{wht}SERIAL IEC  {lbl}DIN 6 p., drive/impres.',
  '{wht}DATASETTE   {lbl}12 pinos, gravador',
  '{wht}CONTROLE 1  {lbl}DE-9, joystick/paddle',
  '{wht}CONTROLE 2  {lbl}DE-9, joystick/mouse',
  '{wht}A/V         {lbl}DIN 5 ou 8 p. (luma,',
  '{wht}            {lbl}croma, composto, áudio)',
  '{wht}RF          {lbl}RCA, modulador de TV',
  '{wht}ENERGIA     {lbl}DIN 7 pinos',
  '',
  '{cyn}TECLADO',
  '{lbl}66 teclas: 64 na matriz 8x8 lida',
  '{lbl}pelo CIA 1, SHIFT LOCK em paralelo',
  '{lbl}com o SHIFT e RESTORE ligado à NMI.',
  ''
];

HW.PLACA = () => [
  bar('PLACAS E REVISÕES', 'gr3'),
  '',
  '{wht}326298 {lbl}1982, primeira placa',
  '{wht}250407 {lbl}1983-84, a mais comum',
  '{wht}250425 {lbl}longboard revisada',
  '{wht}250466 {lbl}última longboard',
  '{wht}250469 {lbl}shortboard (C64C)',
  '',
  '{cyn}C64C (1986) - CHIPS HMOS',
  '{wht}8500 {lbl}CPU      {wht}8565 {lbl}VIC-II PAL',
  '{wht}8580 {lbl}SID 9 V  {wht}8521 {lbl}CIA',
  '{lbl}Menos calor, menos chips e menor',
  '{lbl}consumo, com o mesmo software.',
  '',
  '{cyn}NESTE SIMULADOR',
  '{lbl}Tela 40x25 com memória real em',
  '{lbl}1024 e Color RAM em 55296, POKE e',
  '{lbl}PEEK, SID de 3 vozes em Web Audio',
  '{lbl}e BASIC V2 escrito em JavaScript.',
  ''
];

const HW_ORDER = ['VISAO', 'DIAGRAMA', 'CPU', 'VIC', 'SID', 'CIA', 'MEMORIA', 'MAPA', 'PLA', 'CLOCK', 'ENERGIA', 'PORTAS', 'PLACA'];
const HW_ALIASES = { VIDEO: 'VIC', SOM: 'SID', AUDIO: 'SID', RAM: 'MEMORIA', ROM: 'MEMORIA', IO: 'CIA',
  'E/S': 'CIA', BLOCOS: 'DIAGRAMA', FONTE: 'ENERGIA', CONECTORES: 'PORTAS', REVISOES: 'PLACA', '6510': 'CPU' };

function pageHardware(section) {
  if (section) {
    const key = HW_ALIASES[section] || section;
    if (!HW[key]) return null;
    return HW[key]();
  }
  let L = [];
  HW_ORDER.forEach((k) => { L = L.concat(HW[k]()); });
  L.push('{gr3}Use HARDWARE <SEÇÃO> para ver só uma.');
  return L;
}

/* ---------- HISTÓRIA ---------- */
function pageHistoria() {
  const y = (ano, ...linhas) => {
    const out = ['{yel}' + pad(ano, 5) + '{lbl}' + linhas[0]];
    linhas.slice(1).forEach((l) => out.push('     {lbl}' + l));
    out.push('');
    return out;
  };
  return [
    bar('A HISTÓRIA DO COMMODORE 64', 'yel'),
    '',
    ...y('1954', 'Jack Tramiel funda a Commodore', 'em Toronto, vendendo e consertando', 'máquinas de escrever.'),
    ...y('1976', 'Compra a MOS Technology, criadora', 'do 6502 - a família de CPUs do', 'Apple II, do Atari 2600 e de', 'tantos outros.'),
    ...y('1977', 'Lança o PET 2001, um dos primeiros', 'computadores pessoais completos.'),
    ...y('1980', 'Chega o VIC-20, o primeiro', 'computador a vender 1 milhão.'),
    ...y('1981', 'Em janeiro a equipe da MOS começa', 'os chips VIC-II e SID, pensados', 'para um videogame. Em novembro', 'Tramiel pede um computador com 64', 'KB, pronto para a CES em 2 meses.'),
    ...y('1982', 'Janeiro: o protótipo (VIC-40)', 'estreia na CES de Las Vegas.', 'Agosto: chega às lojas por', 'US$ 595.'),
    ...y('1983', 'Guerra de preços: o C64 cai para', 'cerca de US$ 200 e passa a ser', 'vendido em lojas de brinquedos.', '"Computers for the masses, not', 'the classes."'),
    ...y('1984', 'Tramiel sai da Commodore e compra', 'a divisão de consumo da Atari.', 'Sai o SX-64, versão portátil', 'com monitor colorido embutido.'),
    ...y('1985', 'Commodore 128 (compatível com o', 'C64) e o Amiga 1000.'),
    ...y('1986', 'C64C: gabinete novo, chips HMOS', 'e a interface gráfica GEOS.'),
    ...y('1990', 'C64GS, tentativa de console sem', 'teclado, não decola.'),
    ...y('1994', 'Em abril a Commodore declara', 'falência e a produção termina.'),
    rule(),
    '{cyn}LEGADO',
    '{lbl}Estimativas de 12,5 a 17 milhões',
    '{lbl}de unidades: o modelo de computador',
    '{lbl}mais vendido da história.',
    '',
    '{lbl}Criou a demoscene e a música SID',
    '{lbl}(Rob Hubbard, Martin Galway, Ben',
    '{lbl}Daglish), ainda viva em festas e',
    '{lbl}lançamentos novos todo ano.',
    '',
    '{lbl}Hoje vive em emuladores como o',
    '{lbl}VICE, em placas FPGA e em réplicas',
    '{lbl}modernas.',
    '',
    '{cyn}NO BRASIL',
    '{lbl}A reserva de mercado de informática',
    '{lbl}limitava a importação; o C64 chegava',
    '{lbl}trazido de fora e era raro por aqui,',
    '{lbl}onde reinavam clones nacionais como',
    '{lbl}os TK e os compatíveis Apple II.',
    ''
  ];
}

/* ---------- DISQUETE VIRTUAL ---------- */
const DISK_NAME = 'SIMULADOR C64';
const DISK_ID = 'MS';
const DEMOS = {
  MAZE: [
    '10 REM LABIRINTO INFINITO EM 1 LINHA',
    '20 PRINT CHR$(205.5+RND(1));:GOTO 20'
  ],
  CORES: [
    '10 REM AS 16 CORES DO VIC-II',
    '20 B$="":FOR I=1 TO 30:B$=B$+" ":NEXT',
    '30 PRINT CHR$(147);',
    '40 FOR C=0 TO 15:POKE 646,C',
    '50 PRINT CHR$(18);B$;CHR$(146);C',
    '60 NEXT',
    '70 FOR T=1 TO 250',
    '80 POKE 53280,RND(1)*16:NEXT',
    '90 POKE 53280,14:POKE 646,14'
  ],
  PRIMOS: [
    '10 REM NUMEROS PRIMOS ATE 300',
    '20 PRINT CHR$(147);"NUMEROS PRIMOS ATE 300":PRINT',
    '25 T0=TI',
    '30 FOR N=2 TO 300',
    '40 FOR D=2 TO SQR(N)',
    '50 IF N/D=INT(N/D) AND N<>D THEN 80',
    '60 NEXT D',
    '70 PRINT N;',
    '80 NEXT N',
    '90 PRINT:PRINT:PRINT "TEMPO:";INT((TI-T0)/6)/10;"SEGUNDOS"'
  ],
  ADIVINHE: [
    '10 REM JOGO: ADIVINHE O NUMERO',
    '20 PRINT CHR$(147);CHR$(158);"ADIVINHE O NUMERO DE 1 A 100"',
    '30 PRINT CHR$(154):N=INT(RND(1)*100)+1:T=0',
    '40 INPUT "SEU PALPITE";P:T=T+1',
    '50 IF P<N THEN PRINT "  ";CHR$(30);"MAIOR!";CHR$(154):GOTO 40',
    '60 IF P>N THEN PRINT "  ";CHR$(28);"MENOR!";CHR$(154):GOTO 40',
    '70 PRINT:PRINT CHR$(5);"ACERTOU EM";T;"TENTATIVAS!";CHR$(154)'
  ],
  MUSICA: [
    '10 REM ESCALA DE DO MAIOR NO SID',
    '20 S=54272:FOR I=0 TO 24:POKE S+I,0:NEXT',
    '30 POKE S+24,15:POKE S+5,9:POKE S+6,0',
    '40 PRINT CHR$(147);"TOCANDO NO SID (VOZ 1)":PRINT',
    '50 FOR K=1 TO 8:READ N$,H,L',
    '60 PRINT " ";N$;:POKE S+1,H:POKE S,L',
    '70 POKE S+4,17:FOR T=1 TO 160:NEXT',
    '80 POKE S+4,16:FOR T=1 TO 30:NEXT',
    '90 NEXT K:PRINT',
    '100 DATA DO,17,103,RE,19,137,MI,21,237',
    '110 DATA FA,23,59,SOL,26,19,LA,29,69',
    '120 DATA SI,32,218,DO,34,206'
  ],
  ESTRELAS: [
    '10 REM CEU ESTRELADO',
    '20 POKE 53280,0:POKE 53281,0:PRINT CHR$(147)',
    '30 C(0)=1:C(1)=15:C(2)=12:C(3)=7',
    '40 P=1024+INT(RND(1)*1000)',
    '50 POKE P,42+INT(RND(1)*2)*4',
    '60 POKE P+54272,C(INT(RND(1)*4))',
    '70 Q=1024+INT(RND(1)*1000):POKE Q,32',
    '80 GET K$:IF K$="" THEN 40',
    '90 POKE 53280,14:POKE 53281,6:PRINT CHR$(154);CHR$(147)'
  ],
  OLA: [
    '10 REM OLA, MUNDO COLORIDO',
    '20 FOR I=0 TO 15:POKE 646,I',
    '30 PRINT "OLA, MUNDO! ";',
    '40 NEXT:POKE 646,14:PRINT'
  ]
};
