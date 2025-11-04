document.addEventListener('DOMContentLoaded', function () {
    // ---- Selects de zonas ----
    const selContinente = document.getElementById('del-continente');
    const selPais = document.getElementById('del-pais');
    const selCiudad = document.getElementById('del-ciudad');
    const zonasList = document.getElementById('zonas-list');
  
    // ---- Selects de hoteles ----
    const selhContinente = document.getElementById('delh-continente');
    const selhPais = document.getElementById('delh-pais');
    const selhCiudad = document.getElementById('delh-ciudad');
    const hotelesList = document.getElementById('hoteles-list');
  
    // ------- FUNCIONES DE CARGA -------
    function cargarContinentes(select) {
      fetch('http://localhost:3000/api/continentes')
        .then(res => res.json())
        .then(continentes => {
          select.innerHTML = '<option value="">Selecciona un continente</option>';
          continentes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nombre;
            select.appendChild(opt);
          });
          select.disabled = false;
        });
    }
  
    function cargarPaises(idContinente, select) {
      if (!idContinente) {
        select.innerHTML = '<option value="">Selecciona un país</option>';
        select.disabled = true;
        return;
      }
      fetch(`http://localhost:3000/api/paises/${idContinente}`)
        .then(res => res.json())
        .then(paises => {
          select.innerHTML = '<option value="">Selecciona un país</option>';
          paises.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.nombre;
            select.appendChild(opt);
          });
          select.disabled = false;
        });
    }
  
    function cargarCiudades(idPais, select) {
      if (!idPais) {
        select.innerHTML = '<option value="">Selecciona una ciudad</option>';
        select.disabled = true;
        return;
      }
      fetch(`http://localhost:3000/api/ciudades/${idPais}`)
        .then(res => res.json())
        .then(ciudades => {
          select.innerHTML = '<option value="">Selecciona una ciudad</option>';
          ciudades.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nombre;
            select.appendChild(opt);
          });
          select.disabled = false;
        });
    }
  
    // ------- CARGA DE ZONAS Y ELIMINAR -------
    selContinente.addEventListener('change', function () {
      cargarPaises(this.value, selPais);
      selCiudad.innerHTML = '<option value="">Selecciona una ciudad</option>';
      selCiudad.disabled = true;
      zonasList.innerHTML = '';
    });
    selPais.addEventListener('change', function () {
      cargarCiudades(this.value, selCiudad);
      zonasList.innerHTML = '';
    });
    selCiudad.addEventListener('change', function () {
      if (!this.value) {
        zonasList.innerHTML = '';
        return;
      }
      fetch(`http://localhost:3000/api/zonas/${this.value}`)
        .then(res => res.json())
        .then(zonas => {
          zonasList.innerHTML = '';
          if (!zonas.length) {
            zonasList.innerHTML = '<i>No hay zonas en esta ciudad.</i>';
            return;
          }
          zonas.forEach(zona => {
            const div = document.createElement('div');
            div.className = 'item-row';
            div.innerHTML = `
              <span><b>${zona.nombre}</b>: ${zona.descripcion}</span>
              <button class="danger-btn" data-id="${zona.id}">Eliminar</button>
            `;
            zonasList.appendChild(div);
          });
          // Botón eliminar
          zonasList.querySelectorAll('button.danger-btn').forEach(btn => {
            btn.addEventListener('click', function () {
              if (!confirm('¿Seguro que quieres eliminar esta zona? Si hay hoteles en esta zona, no se podrá eliminar.')) return;
              fetch(`http://localhost:3000/api/zona/${btn.dataset.id}`, { method: 'DELETE' })
                .then(res => res.json())
                .then(resp => {
                  if (resp.success) {
                    alert('Zona eliminada correctamente.');
                    selCiudad.dispatchEvent(new Event('change'));
                  } else {
                    alert(resp.error || 'No se pudo eliminar (quizá hay hoteles en esta zona).');
                  }
                });
            });
          });
        });
    });
  
    // ------- CARGA DE HOTELES Y ELIMINAR -------
    selhContinente.addEventListener('change', function () {
      cargarPaises(this.value, selhPais);
      selhCiudad.innerHTML = '<option value="">Selecciona una ciudad</option>';
      selhCiudad.disabled = true;
      hotelesList.innerHTML = '';
    });
    selhPais.addEventListener('change', function () {
      cargarCiudades(this.value, selhCiudad);
      hotelesList.innerHTML = '';
    });
    selhCiudad.addEventListener('change', function () {
      if (!this.value) {
        hotelesList.innerHTML = '';
        return;
      }
      // Listar hoteles de esa ciudad (puedes hacer un endpoint /api/hoteles/ciudad/:id)
      fetch(`http://localhost:3000/api/hoteles/ciudad/${this.value}`)
        .then(res => res.json())
        .then(hoteles => {
          hotelesList.innerHTML = '';
          if (!hoteles.length) {
            hotelesList.innerHTML = '<i>No hay hoteles en esta ciudad.</i>';
            return;
          }
          hoteles.forEach(hotel => {
            const div = document.createElement('div');
            div.className = 'item-row';
            div.innerHTML = `
              <span><b>${hotel.nombre}</b> (${hotel.estrellas}★)</span>
              <button class="danger-btn" data-id="${hotel.id}">Eliminar</button>
            `;
            hotelesList.appendChild(div);
          });
          hotelesList.querySelectorAll('button.danger-btn').forEach(btn => {
            btn.addEventListener('click', function () {
              if (!confirm('¿Seguro que quieres eliminar este hotel?')) return;
              fetch(`http://localhost:3000/api/hotel/${btn.dataset.id}`, { method: 'DELETE' })
                .then(res => res.json())
                .then(resp => {
                  if (resp.success) {
                    alert('Hotel eliminado correctamente.');
                    selhCiudad.dispatchEvent(new Event('change'));
                  } else {
                    alert(resp.error || 'No se pudo eliminar.');
                  }
                });
            });
          });
        });
    });
  
    // ------- Inicializar selects -------
    cargarContinentes(selContinente);
    cargarContinentes(selhContinente);
  });
  