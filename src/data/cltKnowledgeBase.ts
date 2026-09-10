export interface CltArtigo {
  id: string
  categoria: 'Férias' | 'Jornada' | 'Atestados' | 'Rescisão'
  artigoRef: string
  titulo: string
  resumo: string
  textoCompleto: string
  tags: string[]
  prazoAlerta?: string
}

export const BASE_CLT: CltArtigo[] = [
  // FÉRIAS
  {
    id: 'clt-ferias-aquisitivo',
    categoria: 'Férias',
    artigoRef: 'Art. 130 da CLT',
    titulo: 'Período Aquisitivo e Direito a Férias',
    resumo:
      'A cada 12 meses de vigência do contrato de trabalho, o empregado tem direito a férias na proporção de sua assiduidade.',
    textoCompleto: `Art. 130 - Após cada período de 12 (doze) meses de vigência do contrato de trabalho, o empregado terá direito a férias, na seguinte proporção:
I - 30 (trinta) dias corridos, quando não houver faltado ao serviço mais de 5 (cinco) vezes;
II - 24 (vinte e quatro) dias corridos, quando houver tido de 6 (seis) a 14 (quatorze) faltas;
III - 18 (dezoito) dias corridos, quando houver tido de 15 (quinze) a 23 (vinte e três) faltas;
IV - 12 (doze) dias corridos, quando houver tido de 24 (vinte e quatro) a 32 (trinta e duas) faltas.
§ 1º É vedado descontar, do período de férias, as faltas do empregado ao serviço.
§ 2º O período das férias será computado, para todos os efeitos, como tempo de serviço.`,
    tags: ['férias', 'período aquisitivo', 'faltas', '30 dias', 'assiduidade', 'dias corridos'],
    prazoAlerta: 'Período aquisitivo: 12 meses trabalhados',
  },
  {
    id: 'clt-ferias-concessivo',
    categoria: 'Férias',
    artigoRef: 'Art. 134 e 137 da CLT',
    titulo: 'Período Concessivo e Pagamento em Dobro',
    resumo:
      'As férias devem ser concedidas nos 12 meses subsequentes ao período aquisitivo. Se ultrapassar o prazo, o empregador pagará em dobro.',
    textoCompleto: `Art. 134 - As férias serão concedidas por ato do empregador, em um só período, nos 12 (doze) meses subsequentes à data em que o empregado tiver adquirido o direito.
§ 1º Desde que haja concordância do empregado, as férias poderão ser usufruídas em até três períodos, sendo que um deles não poderá ser inferior a 14 (quatorze) dias corridos e os demais não poderão ser inferiores a 5 (cinco) dias corridos, cada um.
§ 3º É vedado o início das férias no período de dois dias que antecede feriado ou dia de repouso semanal remunerado.

Art. 137 - Sempre que as férias forem concedidas após o prazo de que trata o art. 134, o empregador pagará em dobro a respectiva remuneração.`,
    tags: [
      'período concessivo',
      'férias em dobro',
      'fracionamento',
      'três períodos',
      'vedação feriado',
    ],
    prazoAlerta: 'Limite: 12 meses após término do aquisitivo (risco de dobro)',
  },
  {
    id: 'clt-ferias-pagamento',
    categoria: 'Férias',
    artigoRef: 'Art. 145 da CLT e Súmula 450 TST',
    titulo: 'Prazo para Pagamento da Remuneração das Férias',
    resumo:
      'O pagamento da remuneração das férias e do terço constitucional deve ser efetuado até 2 dias antes do início do gozo.',
    textoCompleto: `Art. 145 - O pagamento da remuneração das férias e, se for o caso, o do abono referido no art. 143 serão efetuados até 2 (dois) dias antes do início do respectivo período.
Parágrafo único - O empregado dará quitação do pagamento, com indicação do início e do termo das férias.
A Constituição Federal de 1988 (Art. 7º, XVII) assegura o terço constitucional (1/3) obrigatório integrado a este pagamento antecedente.`,
    tags: ['pagamento de férias', 'prazo 2 dias', 'terço constitucional', '1/3', 'adiantamento'],
    prazoAlerta: 'Até 2 dias úteis antes do início do gozo das férias',
  },
  {
    id: 'clt-ferias-abono',
    categoria: 'Férias',
    artigoRef: 'Art. 143 da CLT',
    titulo: 'Abono Pecuniário ("Venda de Férias")',
    resumo:
      'O empregado pode converter 1/3 do seu período de férias em abono pecuniário, devendo requerer até 15 dias antes do vencimento do aquisitivo.',
    textoCompleto: `Art. 143 - É facultado ao empregado converter 1/3 (um terço) do período de férias a que tiver direito em abono pecuniário, no valor da remuneração que lhe seria devida nos dias correspondentes.
§ 1º O abono de férias deverá ser requerido até 15 (quinze) dias antes de terminar o período aquisitivo.
§ 2º Tratando-se de férias coletivas, a conversão do abono dependerá de acordo coletivo entre o empregador e o sindicato representativo da respectiva categoria profissional.`,
    tags: [
      'abono pecuniário',
      'venda de férias',
      '10 dias',
      '15 dias antes',
      'conversão em dinheiro',
    ],
    prazoAlerta: 'Requerimento do colaborador até 15 dias antes do fim do aquisitivo',
  },

  // JORNADA DE TRABALHO
  {
    id: 'clt-jornada-limite',
    categoria: 'Jornada',
    artigoRef: 'Art. 58 e 59 da CLT',
    titulo: 'Limite Diário de Jornada e Horas Extras',
    resumo:
      'A duração normal de trabalho não excederá 8 horas diárias e 44 semanais. Prorrogação máxima de 2 horas extras diárias remuneradas com adicional mín. de 50%.',
    textoCompleto: `Art. 58 - A duração normal do trabalho, para os empregados em qualquer atividade privada, não excederá de 8 (oito) horas diárias, desde que não seja fixado expressamente outro limite.
§ 1º Não serão descontadas nem computadas como jornada extraordinária as variações de horário no registro de ponto não excedentes de cinco minutos, observado o limite máximo de dez minutos diários.

Art. 59 - A duração diária do trabalho poderá ser acrescida de horas extras, em número não excedente de duas, por acordo individual, convenção coletiva ou acordo coletivo de trabalho.
§ 1º A remuneração da hora extra será, pelo menos, 50% (cinquenta por cento) superior à da hora normal.`,
    tags: [
      'jornada diária',
      '8 horas',
      '44 horas semanais',
      'horas extras',
      'adicional 50%',
      'tolerância 10 min',
    ],
    prazoAlerta: 'Máximo de 2 horas extras por dia; tolerância de 10 min diários',
  },
  {
    id: 'clt-jornada-intervalo',
    categoria: 'Jornada',
    artigoRef: 'Art. 71 da CLT',
    titulo: 'Intervalo Intrajornada (Refeição e Descanso)',
    resumo:
      'Para trabalho superior a 6 horas, é obrigatório intervalo de no mínimo 1 hora (ou 30 min se previsto em CCT). Entre 4 e 6 horas, intervalo obrigatório de 15 minutos.',
    textoCompleto: `Art. 71 - Em qualquer trabalho contínuo, cuja duração exceda de 6 (seis) horas, é obrigatória a concessão de um intervalo para repouso ou alimentação, o qual será, no mínimo, de 1 (uma) hora e, salvo acordo escrito ou convenção coletiva em contrário, não poderá exceder de 2 (duas) horas.
§ 1º Não excedendo de 6 (seis) horas o trabalho, será, entretanto, obrigatório um intervalo de 15 (quinze) minutos quando a duração ultrapassar 4 (quatro) horas.
§ 4º A não concessão ou a concessão parcial do intervalo intrajornada mínimo, para repouso e alimentação, a empregados urbanos e rurais, implica o pagamento, de natureza indenizatória, apenas do período suprimido, com acréscimo de 50% (cinquenta por cento) sobre o valor da remuneração da hora normal de trabalho.`,
    tags: ['intervalo intrajornada', 'almoço', '1 hora', '15 minutos', 'descanso', 'refeição'],
    prazoAlerta: 'Acima de 6h: mín. 1 hora; Entre 4h e 6h: 15 minutos',
  },
  {
    id: 'clt-jornada-banco',
    categoria: 'Jornada',
    artigoRef: 'Art. 59 § 2º e § 5º da CLT',
    titulo: 'Banco de Horas e Compensação de Jornada',
    resumo:
      'Acordo individual escrito permite compensação em até 6 meses. Acordo coletivo permite compensação em até 1 ano. Compensação no mesmo mês dispensa formalidade.',
    textoCompleto: `Art. 59 § 2º - Poderá ser dispensado o acréscimo de salário se, por força de acordo ou convenção coletiva de trabalho, o excesso de horas em um dia for compensado pela correspondente diminuição em outro dia, de maneira que não exceda, no período máximo de um ano, à soma das jornadas semanais de trabalho previstas, nem seja ultrapassado o limite máximo de dez horas diárias.
§ 5º O banco de horas de que trata o § 2º deste artigo poderá ser pactuado por acordo individual escrito, desde que a compensação ocorra no período máximo de seis meses.
§ 6º É lícito o regime de compensação de jornada estabelecido por acordo individual, tácito ou escrito, para a compensação no mesmo mês.`,
    tags: [
      'banco de horas',
      'compensação',
      'acordo individual',
      '6 meses',
      'acordo coletivo',
      '1 ano',
    ],
    prazoAlerta: '6 meses (acordo individual) ou 1 ano (acordo/convenção coletiva)',
  },
  {
    id: 'clt-jornada-interjornada',
    categoria: 'Jornada',
    artigoRef: 'Art. 66 e 67 da CLT',
    titulo: 'Intervalo Interjornada e DSR',
    resumo:
      'Entre duas jornadas de trabalho haverá um período mínimo de 11 horas consecutivas para descanso. Repouso semanal de 24 horas consecutivas (DSR).',
    textoCompleto: `Art. 66 - Entre 2 (duas) jornadas de trabalho haverá um período mínimo de 11 (onze) horas consecutivas para descanso.
Art. 67 - Será assegurado a todo empregado um descanso semanal remunerado de 24 (vinte e quatro) horas consecutivas, o qual, salvo motivo de conveniência pública ou necessidade imperiosa do serviço, deverá coincidir com o domingo, no todo ou em parte.`,
    tags: ['interjornada', '11 horas de descanso', 'DSR', 'repouso semanal remunerado', 'domingo'],
    prazoAlerta: 'Mínimo de 11 horas ininterruptas entre a saída e o próximo retorno',
  },

  // ATESTADOS E LICENÇAS
  {
    id: 'clt-atestados-abono',
    categoria: 'Atestados',
    artigoRef: 'Art. 473 da CLT e Lei 605/1949',
    titulo: 'Atestado Médico e Prazo de Pagamento pela Empresa',
    resumo:
      'A empresa é responsável pelo pagamento dos primeiros 15 dias consecutivos de afastamento por incapacidade. Do 16º dia em diante, o colaborador é encaminhado ao INSS.',
    textoCompleto: `Art. 60, § 3º da Lei 8.213/1991 e Regulamento da CLT:
Durante os primeiros 15 (quinze) dias consecutivos ao do afastamento da atividade por motivo de doença ou acidente, incumbe à empresa pagar ao segurado empregado o seu salário integral.
A partir do 16º (décimo sexto) dia de afastamento, o benefício passa a ser suportado pela Previdência Social (Auxílio por Incapacidade Temporária / Auxílio-doença).
Atestados médicos emitidos por profissionais habilitados (médicos e cirurgiões-dentistas com CRM/CRO) possuem fé pública e justificam legalmente as faltas com abono salarial integral.`,
    tags: [
      'atestado médico',
      'afastamento',
      '15 dias empresa',
      '16º dia INSS',
      'auxílio-doença',
      'CRM',
    ],
    prazoAlerta: 'Empresa paga até 15 dias; a partir do 16º encaminhar ao INSS',
  },
  {
    id: 'clt-atestados-comparecimento',
    categoria: 'Atestados',
    artigoRef: 'Art. 473 da CLT e Jurisprudência TST',
    titulo: 'Atestado de Comparecimento vs Atestado Médico de Incapacidade',
    resumo:
      'Declaração de comparecimento abona apenas as horas comprovadas de atendimento médico/exames, não o dia todo, exceto se houver determinação expressa em CCT.',
    textoCompleto: `Art. 473, X, XI e XII da CLT:
O empregado poderá deixar de comparecer ao serviço sem prejuízo do salário:
X - até 2 (dois) dias para acompanhar consultas médicas e exames complementares durante o período de gravidez de sua esposa ou companheira;
XI - por 1 (um) dia por ano para acompanhar filho de até 6 (seis) anos em consulta médica;
XII - até 3 (três) dias, em cada 12 (doze) meses de trabalho, em caso de realização de exames preventivos de câncer devidamente comprovada.
Atestados de comparecimento simples (declaração de horas de permanência em clínica/posto): abonam exclusivamente o período de permanência e deslocamento razoável, devendo o colaborador retornar ao expediente salvo recomendação médica em contrário.`,
    tags: [
      'declaração de comparecimento',
      'consulta médica',
      'horas de consulta',
      'acompanhamento de filho',
      'gravidez',
    ],
    prazoAlerta: 'Abona as horas de atendimento; avaliar retorno no restante do turno',
  },
  {
    id: 'clt-atestados-licencas',
    categoria: 'Atestados',
    artigoRef: 'Art. 473 da CLT',
    titulo: 'Licenças Remuneradas Legais (Gala, Nojo e Outras)',
    resumo:
      'Licença casamento (3 dias), luto/óbito (2 dias para cônjuge, pais e filhos), doação de sangue (1 dia/ano), alistamento eleitoral (2 dias).',
    textoCompleto: `Art. 473 - O empregado poderá deixar de comparecer ao serviço sem prejuízo do salário:
I - até 2 (dois) dias consecutivos, em caso de falecimento do cônjuge, ascendente, descendente, irmão ou pessoa que viva sob sua dependência econômica;
II - até 3 (três) dias consecutivos, em virtude de casamento;
III - por 5 (cinco) dias consecutivos, em caso de nascimento de filho (licença-paternidade conforme CF/88 Art. 7º, XIX);
IV - por 1 (um) dia, em cada 12 (doze) meses de trabalho, em caso de doação voluntária de sangue devidamente comprovada;
V - até 2 (dois) dias consecutivos ou não, para o fim de se alistar eleitor.`,
    tags: [
      'licença gala',
      'licença nojo',
      'casamento',
      'luto',
      'licença-paternidade',
      'doação de sangue',
    ],
    prazoAlerta: 'Casamento: 3 dias; Falecimento: 2 dias; Paternidade: 5 dias',
  },

  // RESCISÃO CONTRATUAL
  {
    id: 'clt-rescisao-aviso',
    categoria: 'Rescisão',
    artigoRef: 'Art. 487 da CLT e Lei 12.506/2011',
    titulo: 'Aviso Prévio Proporcional ao Tempo de Serviço',
    resumo:
      'O aviso prévio é de 30 dias para empregados com até 1 ano de serviço, acrescido de 3 dias por ano completo trabalhado, até o limite de 90 dias.',
    textoCompleto: `Lei nº 12.506/2011 e Art. 487 da CLT:
O aviso prévio, de que trata o Capítulo VI do Título IV da CLT, será concedido na proporção de 30 (trinta) dias aos empregados que contem até 1 (um) ano de serviço na mesma empresa.
Ao aviso prévio serão acrescidos 3 (três) dias por ano de serviço prestado na mesma empresa, até o máximo de 60 (sessenta) dias, perfazendo um total de até 90 (noventa) dias.
Na dispensa pelo empregador com aviso trabalhado, o colaborador pode optar por reduzir 2 horas diárias da jornada ou ausentar-se por 7 dias corridos consecutivos (Art. 488 da CLT).`,
    tags: [
      'aviso prévio',
      'proporcional',
      'lei 12506',
      '3 dias por ano',
      'máximo 90 dias',
      'redução 2h ou 7 dias',
    ],
    prazoAlerta: '30 a 90 dias conforme anos completos de casa',
  },
  {
    id: 'clt-rescisao-pagamento',
    categoria: 'Rescisão',
    artigoRef: 'Art. 477 § 6º e § 8º da CLT',
    titulo: 'Prazo para Pagamento das Verbas Rescisórias',
    resumo:
      'O pagamento de todas as verbas rescisórias deve ser efetuado em até 10 dias corridos após o término do contrato, sob pena de multa equivalente a 1 salário.',
    textoCompleto: `Art. 477 § 6º da CLT (Redação da Reforma Trabalhista Lei 13.467/2017):
A entrega ao empregado de documentos que comprovem a comunicação da extinção contratual aos órgãos competentes bem como o pagamento dos valores constantes do instrumento de rescisão ou recibo de quitação deverão ser efetuados até 10 (dez) dias contados a partir do término do contrato.
§ 8º A inobservância do disposto no § 6º deste artigo sujeitará o infrator à multa de 160 BTN, por trabalhador, bem assim ao pagamento da multa em favor do empregado, em valor equivalente ao seu salário.`,
    tags: [
      'prazo rescisão',
      '10 dias corridos',
      'multa art 477',
      'verbas rescisórias',
      'homologação',
    ],
    prazoAlerta: 'Impreterivelmente até 10 dias corridos após o fim do contrato',
  },
  {
    id: 'clt-rescisao-fgts',
    categoria: 'Rescisão',
    artigoRef: 'Art. 18 da Lei 8.036/1990 e Art. 484-A da CLT',
    titulo: 'Multa Rescisória do FGTS (40% e Acordo Mútuo 20%)',
    resumo:
      'Na demissão sem justa causa, a multa rescisória é de 40% sobre o saldo de todos os depósitos do FGTS. No distrato por acordo mútuo, a multa é de 20%.',
    textoCompleto: `Lei nº 8.036/1990, Art. 18, § 1º:
Na hipótese de despedida pelo empregador sem justa causa, depositará este, na conta vinculada do trabalhador no FGTS, importância igual a 40% (quarenta por cento) do montante de todos os depósitos realizados na conta vinculada durante a vigência do contrato de trabalho, atualizados monetariamente e acrescidos dos respectivos juros.

Art. 484-A da CLT (Rescisão por Acordo Mútuo):
O contrato de trabalho poderá ser extinto por acordo entre empregado e empregador, caso em que serão devidos:
I - por metade:
a) o aviso prévio, se indenizado; e
b) a indenização sobre o saldo do FGTS (20% em vez de 40%);
II - na integralidade, as demais verbas trabalhistas.
O empregado saca até 80% do saldo do FGTS e não tem direito ao seguro-desemprego.`,
    tags: ['multa FGTS', '40%', 'acordo mútuo', '20%', 'rescisão sem justa causa', 'saque 80%'],
    prazoAlerta: 'Guia GRRF recolhida dentro do prazo de até 10 dias da rescisão',
  },
  {
    id: 'clt-rescisao-estabilidade',
    categoria: 'Rescisão',
    artigoRef: 'Art. 10, II, "b" do ADCT e Art. 118 da Lei 8.213/1991',
    titulo: 'Estabilidades Provisórias no Emprego',
    resumo:
      'Gestante (desde a confirmação da gravidez até 5 meses após o parto) e acidentado (12 meses após a cessação do auxílio-doença acidentário B91).',
    textoCompleto: `1. Gestante: Art. 10, II, "b" do ADCT: É vedada a dispensa arbitrária ou sem justa causa da empregada gestante, desde a confirmação da gravidez até cinco meses após o parto. A estabilidade existe mesmo se a gravidez ocorrer durante o aviso prévio indenizado (Art. 391-A da CLT).
2. Acidente de Trabalho: Art. 118 da Lei 8.213/1991: O segurado que sofreu acidente do trabalho tem garantida, pelo prazo mínimo de 12 (doze) meses, a manutenção do seu contrato de trabalho na empresa, após a cessação do auxílio-doença acidentário (código B91), independentemente de percepção de auxílio-acidente.
3. Membro da CIPA: Estabilidade do registro da candidatura até 1 ano após o mandato.`,
    tags: [
      'estabilidade',
      'gestante',
      '5 meses pós-parto',
      'acidente de trabalho',
      'B91',
      '12 meses',
      'CIPA',
    ],
    prazoAlerta: 'Gestante: até 5 meses pós-parto; Acidente: 12 meses após alta INSS',
  },
]
