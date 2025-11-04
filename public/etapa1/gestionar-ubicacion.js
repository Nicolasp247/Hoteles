// ============================================================
// Gestuibar Ubicaciones
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    // ==== 1. Añadir Continente ====
    const formContinente = document.getElementById('form-continente');
    if (formContinente) {
      formContinente.addEventListener('submit', function(e) {
        e.preventDefault();
        const nombre = formContinente.nombre_continente.value.trim();
        fetch('http://localhost:3000/api/continente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre_continente: nombre })
        })
        .then(res => res.json())
        .then(data => {
          const mensaje = document.getElementById('mensaje-continente');
          if (data.success) {
            mensaje.textContent = 'Continente añadido con éxito.';
            mensaje.style.color = 'green';
            formContinente.reset();
            cargarContinentes(); // Actualiza selects de continentes
          } else {
            mensaje.textContent = data.error || 'Error al añadir.';
            mensaje.style.color = 'red';
          }
        });
      });
    }
  
    // ==== 2. Llenar todos los selects de continentes ====
    function cargarContinentes() {
      fetch('http://localhost:3000/api/continentes')
        .then(res => res.json())
        .then(continentes => {
          llenarSelect('select-continente-pais', continentes);
          llenarSelect('select-continente-ciudad', continentes);
          llenarSelect('select-continente-zona', continentes);
        });
    }
  
    function llenarSelect(id, opciones) {
      const select = document.getElementById(id);
      if (!select) return;
      select.innerHTML = '<option value="">Selecciona</option>';
      opciones.forEach(op => {
        const opt = document.createElement('option');
        opt.value = op.id;
        opt.textContent = op.nombre;
        select.appendChild(opt);
      });
    }
  
    // ==== 3. Añadir País y cargar países por continente ====
    const formPais = document.getElementById('form-pais');
    const selectContinentePais = document.getElementById('select-continente-pais');
    const selectPaisCiudad = document.getElementById('select-pais-ciudad');
    const selectContinenteCiudad = document.getElementById('select-continente-ciudad');
    const selectPaisZona = document.getElementById('select-pais-zona');
    const selectContinenteZona = document.getElementById('select-continente-zona');
  
    if (formPais) {
      formPais.addEventListener('submit', function(e) {
        e.preventDefault();
        const nombre = formPais.nombre_pais.value.trim();
        const idContinente = formPais.continente.value;
        fetch('http://localhost:3000/api/pais', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre_pais: nombre, id_continente: idContinente })
        })
        .then(res => res.json())
        .then(data => {
          const mensaje = document.getElementById('mensaje-pais');
          if (data.success) {
            mensaje.textContent = 'País añadido con éxito.';
            mensaje.style.color = 'green';
            formPais.reset();
            if (idContinente) cargarPaises(idContinente);
          } else {
            mensaje.textContent = data.error || 'Error al añadir.';
            mensaje.style.color = 'red';
          }
        });
      });
    }
  
    // Cuando cambie el continente en país, carga los países correspondientes
    if (selectContinentePais) {
      selectContinentePais.addEventListener('change', function() {
        cargarPaises(this.value, 'select-pais-ciudad');
        cargarPaises(this.value, 'select-pais-zona');
      });
    }
    if (selectContinenteCiudad) {
      selectContinenteCiudad.addEventListener('change', function() {
        cargarPaises(this.value, 'select-pais-ciudad');
      });
    }
    if (selectContinenteZona) {
      selectContinenteZona.addEventListener('change', function() {
        cargarPaises(this.value, 'select-pais-zona');
      });
    }
  
    function cargarPaises(idContinente, idSelect) {
      if (!idContinente) {
        if (idSelect) document.getElementById(idSelect).innerHTML = '<option value="">Selecciona</option>';
        return;
      }
      fetch(`http://localhost:3000/api/paises/${idContinente}`)
        .then(res => res.json())
        .then(paises => {
          if (idSelect) {
            llenarSelect(idSelect, paises);
          } else {
            llenarSelect('select-pais-ciudad', paises);
            llenarSelect('select-pais-zona', paises);
          }
        });
    }
  
    // ==== 4. Añadir Ciudad y cargar ciudades por país ====
    const formCiudad = document.getElementById('form-ciudad');
    const selectPaisCiudad2 = document.getElementById('select-pais-ciudad');
    const selectCiudadZona = document.getElementById('select-ciudad-zona');
    const selectPaisZona2 = document.getElementById('select-pais-zona');
  
    if (formCiudad) {
      formCiudad.addEventListener('submit', function(e) {
        e.preventDefault();
        const nombre = formCiudad.nombre_ciudad.value.trim();
        const idPais = formCiudad.pais.value;
        fetch('http://localhost:3000/api/ciudad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre_ciudad: nombre, id_pais: idPais })
        })
        .then(res => res.json())
        .then(data => {
          const mensaje = document.getElementById('mensaje-ciudad');
          if (data.success) {
            mensaje.textContent = 'Ciudad añadida con éxito.';
            mensaje.style.color = 'green';
            formCiudad.reset();
            if (idPais) cargarCiudades(idPais);
          } else {
            mensaje.textContent = data.error || 'Error al añadir.';
            mensaje.style.color = 'red';
          }
        });
      });
    }
  
    // Cuando cambie el país en ciudad o zona, carga las ciudades correspondientes
    if (selectPaisCiudad) {
      selectPaisCiudad.addEventListener('change', function() {
        cargarCiudades(this.value, 'select-ciudad-zona');
      });
    }
    if (selectPaisZona) {
      selectPaisZona.addEventListener('change', function() {
        cargarCiudades(this.value, 'select-ciudad-zona');
      });
    }
  
    function cargarCiudades(idPais, idSelect) {
      if (!idPais) {
        if (idSelect) document.getElementById(idSelect).innerHTML = '<option value="">Selecciona</option>';
        return;
      }
      fetch(`http://localhost:3000/api/ciudades/${idPais}`)
        .then(res => res.json())
        .then(ciudades => {
          if (idSelect) {
            llenarSelect(idSelect, ciudades);
          } else {
            llenarSelect('select-ciudad-zona', ciudades);
          }
        });
    }
  
    // ==== 5. Añadir Zona ====
    const formZona = document.getElementById('form-zona');
    if (formZona) {
      formZona.addEventListener('submit', function(e) {
        e.preventDefault();
        const nombre = formZona.nombre_zona.value.trim();
        const descripcion = formZona.descripcion_zona.value.trim();
        const idCiudad = formZona.ciudad.value;
        fetch('http://localhost:3000/api/zona', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre_zona: nombre, descripcion_zona: descripcion, id_ciudad: idCiudad })
        })
        .then(res => res.json())
        .then(data => {
          const mensaje = document.getElementById('mensaje-zona');
          if (data.success) {
            mensaje.textContent = 'Zona añadida con éxito.';
            mensaje.style.color = 'green';
            formZona.reset();
          } else {
            mensaje.textContent = data.error || 'Error al añadir.';
            mensaje.style.color = 'red';
          }
        });
      });
    }
  
    // ==== 6. Inicializar selects al cargar la página ====
    cargarContinentes();
  });