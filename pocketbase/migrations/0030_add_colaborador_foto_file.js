migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('colaborador')
    // Garantir que foto_url não tenha limite ou tenha limite amplo se for text
    const fotoField = col.fields.getByName('foto_url')
    if (fotoField) {
      fotoField.max = 0
    }
    // Adicionar campo foto (tipo file) para armazenar imagens de até 5MB
    if (!col.fields.getByName('foto')) {
      col.fields.add(
        new FileField({
          name: 'foto',
          maxSelect: 1,
          maxSize: 5242880, // 5MB
          mimeTypes: ['image/jpeg', 'image/png', 'image/jpg'],
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('colaborador')
      col.fields.removeByName('foto')
      app.save(col)
    } catch (_) {}
  },
)
