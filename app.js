
function generateTodayReport() {
  fetch('/exportar-relatorio')
    .then(response => {
      if (response.ok) {
        alert('Relatório do dia exportado com sucesso!');
      } else {
        alert('Erro ao exportar o relatório do dia.');
      }
    });
}

function exportCompleteReport() {
  fetch('/exportar-relatorio-completo')
    .then(response => {
      if (response.ok) {
        alert('Relatório completo exportado com sucesso!');
      } else {
        alert('Erro ao exportar o relatório completo.');
      }
    });
}

function viewReports() {
  fetch('/api/saidas')
    .then(response => response.json())
    .then(data => {
      const tbody = document.querySelector('#reportTable tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      const grouped = {};

      data.forEach(item => {
        const date = item.data || new Date(item.timestamp).toISOString().split('T')[0];
        const tipo = item.tipo;
        const key = `${date}|${tipo}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
      });

      Object.entries(grouped).forEach(([key, items]) => {
        const [data, tipo] = key.split('|');
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${data}</td>
          <td>${tipo}</td>
          <td>${items.length}</td>
          <td><button onclick="alert('Detalhamento futuro')">Ver</button></td>
        `;
        tbody.appendChild(row);
      });
    });
}

document.addEventListener('DOMContentLoaded', () => {
  const url = window.location.pathname;
  if (url.includes('relatorios.html')) {
    viewReports();
  }
});



app.post('/editar/:id', async (req, res) => {
  const { nome, descricao, quantidade, unidade, tipo, observacao } = req.body;

  try {
    const item = await Saida.findById(req.params.id);
    if (!item) return res.status(404).send('Item não encontrado');

    item.nome = nome;
    item.descricao = descricao;
    item.quantidade = quantidade;
    item.unidade = unidade;
    item.tipo = tipo;
    item.observacao = observacao + " (editado em " + new Date().toLocaleString() + ")";

    await item.save();
    io.emit('update');
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send('Erro ao editar item');
  }
});



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
