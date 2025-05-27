
const ExcelJS = require('exceljs');

app.get('/exportar-relatorio-excel', async (req, res) => {
  const { inicio, fim } = req.query;

  if (!inicio || !fim) {
    return res.status(400).send('Datas de início e fim são obrigatórias.');
  }

  try {
    const dados = await Saida.find({
      data: { $gte: inicio, $lte: fim }
    });

    if (!dados.length) {
      return res.status(404).send('Nenhum item encontrado no intervalo informado.');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório');

    worksheet.columns = [
      { header: 'Nome', key: 'nome', width: 20 },
      { header: 'Descrição', key: 'descricao', width: 25 },
      { header: 'Quantidade', key: 'quantidade', width: 10 },
      { header: 'Unidade', key: 'unidade', width: 10 },
      { header: 'Tipo', key: 'tipo', width: 15 },
      { header: 'Data', key: 'data', width: 15 },
      { header: 'Entregue?', key: 'delivered', width: 10 },
      { header: 'Observação', key: 'observacao', width: 30 }
    ];

    dados.forEach(item => {
      worksheet.addRow({
        nome: item.nome,
        descricao: item.descricao,
        quantidade: item.quantidade,
        unidade: item.unidade,
        tipo: item.tipo,
        data: item.data,
        delivered: item.delivered ? 'Sim' : 'Não',
        observacao: item.observacao || ''
      });
    });

    const fileName = `relatorio_${inicio}_a_${fim}.xlsx`;
    const filePath = path.join(__dirname, fileName);
    await workbook.xlsx.writeFile(filePath);

    res.download(filePath, fileName, (err) => {
      if (!err) fs.unlink(filePath, () => {});
    });
  } catch (err) {
    res.status(500).send('Erro ao gerar relatório Excel.');
  }
});
