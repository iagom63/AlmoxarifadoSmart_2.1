
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
