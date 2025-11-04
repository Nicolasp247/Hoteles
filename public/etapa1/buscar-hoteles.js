document.addEventListener('DOMContentLoaded', function() {
    // ====== 1. Selects de filtros ======
    const filtroContinente = document.getElementById('filtro-continente');
    const filtroPais = document.getElementById('filtro-pais');
    const filtroCiudad = document.getElementById('filtro-ciudad');
    const filtroEstrellasDiv = document.getElementById('filtro-estrellas');
    const btnBuscar = document.getElementById('btn-buscar');
    const tablaBody = document.querySelector('#tabla-hoteles tbody');
  
    // ---- Cargar continentes en filtro ----
    fetch('http://localhost:3000/api/continentes')
      .then(res => res.json())
      .then(continentes => {
        filtroContinente.innerHTML = '<option value="">Todos</option>';
        continentes.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.nombre;
          filtroContinente.appendChild(opt);
        });
        filtroContinente.disabled = false;
      });
  
    // ---- Cuando cambias continente, carga países ----
    filtroContinente.addEventListener('change', function() {
      filtroPais.innerHTML = '<option value="">Todos</option>';
      filtroPais.disabled = true;
      filtroCiudad.innerHTML = '<option value="">Todos</option>';
      filtroCiudad.disabled = true;
      if (this.value) {
        fetch(`http://localhost:3000/api/paises/${this.value}`)
          .then(res => res.json())
          .then(paises => {
            paises.forEach(p => {
              const opt = document.createElement('option');
              opt.value = p.id;
              opt.textContent = p.nombre;
              filtroPais.appendChild(opt);
            });
            filtroPais.disabled = false;
          });
      }
    });
  
    // ---- Cuando cambias país, carga ciudades ----
    filtroPais.addEventListener('change', function() {
      filtroCiudad.innerHTML = '<option value="">Todos</option>';
      filtroCiudad.disabled = true;
      if (this.value) {
        fetch(`http://localhost:3000/api/ciudades/${this.value}`)
          .then(res => res.json())
          .then(ciudades => {
            ciudades.forEach(c => {
              const opt = document.createElement('option');
              opt.value = c.id;
              opt.textContent = c.nombre;
              filtroCiudad.appendChild(opt);
            });
            filtroCiudad.disabled = false;
          });
      }
    });
  
    // ---- Filtro de estrellas: Solo permitir "Todos" o al menos una categoría ----
    const checkTodos = document.getElementById('check-todos');
    const checkEstrellas = Array.from(document.querySelectorAll('.check-estrella'));
    checkTodos.addEventListener('change', function() {
      if (checkTodos.checked) {
        checkEstrellas.forEach(chk => chk.checked = false);
      }
    });
    checkEstrellas.forEach(chk => {
      chk.addEventListener('change', function() {
        if (checkEstrellas.some(c => c.checked)) {
          checkTodos.checked = false;
        } else {
          checkTodos.checked = true;
        }
      });
    });
  
    // ====== 2. Buscar hoteles cuando le des click al botón ======
    btnBuscar.addEventListener('click', function() {
      buscarHoteles();
    });
  
    // Función para buscar hoteles y mostrarlos en la tabla
    function buscarHoteles() {
      // 1. Tomar filtros
      const idContinente = filtroContinente.value;
      const idPais = filtroPais.value;
      const idCiudad = filtroCiudad.value;
      // Estrellas
      let estrellas = [];
      if (!checkTodos.checked) {
        estrellas = checkEstrellas.filter(c => c.checked).map(c => c.value);
      }
  
      // 2. Hacer la petición al backend con los filtros
      // ¡Ojo! Este endpoint lo tienes que crear en tu backend.
      fetch('http://localhost:3000/api/buscar-hoteles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idContinente,
          idPais,
          idCiudad,
          estrellas // array (puede estar vacío si es "Todos")
        })
      })
      .then(res => res.json())
      .then(hoteles => {
        
        
        // Limpiar la tabla
        tablaBody.innerHTML = "";
        if (!hoteles.length) {
          tablaBody.innerHTML = `<tr><td colspan="9" style="text-align:center">No se encontraron hoteles</td></tr>`;
          return;
        }
        // Mostrar cada hotel
        hoteles.forEach(hotel => {
          // Zona 1 y 2
          const zona1Text = hotel.zona1_nombre ? `${hotel.zona1_nombre} (${hotel.zona1_metros} m)` : "-";
          const zona2Text = hotel.zona2_nombre ? `${hotel.zona2_nombre} (${hotel.zona2_metros} m)` : "-";
          // Booking y Tripadvisor (íconos)
          const bookingLink = hotel.link_booking
            ? `<a href="${hotel.link_booking}" target="_blank" class="icon-link"><img src="img/icono-booking.png" alt="Booking"></a>`
            : "-";
          const tripadvisorLink = hotel.link_tripadvisor
            ? `<a href="${hotel.link_tripadvisor}" target="_blank" class="icon-link"><img src="img/icono-tripadvisor.png" alt="TripAdvisor"></a>`
            : "-";
  
          tablaBody.innerHTML += `
            <tr>
              <td>${hotel.nombre}</td>
              <td>${hotel.estrellas}</td>
              <td>${hotel.booking_score}</td>
              <td>${hotel.tripadvisor_score}</td>
              <td>${hotel.descripcion}</td>
              <td>${zona1Text}</td>
              <td>${zona2Text}</td>
              <td>${bookingLink}</td>
              <td>${tripadvisorLink}</td>
            </tr>
          `;
        });
      });
    }
  });
  