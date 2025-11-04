document.addEventListener('DOMContentLoaded', function() {
    // Filtros
    const filtroContinente = document.getElementById('filtro-continente');
    const filtroPais = document.getElementById('filtro-pais');
    const filtroCiudad = document.getElementById('filtro-ciudad');
    const selectHotel = document.getElementById('select-hotel');
    const form = document.getElementById('form-editar-hotel');
    const mensajeDiv = document.getElementById('mensaje');
    const selectZona1 = document.getElementById('select-zona1');
    const selectZona2 = document.getElementById('select-zona2');
    
    let hotelesCargados = []; // Cache de hoteles de la ciudad
    let zonasCargadas = [];   // Cache de zonas de la ciudad
  
    // ========== 1. Cargar Continentes ==========
    fetch('http://localhost:3000/api/continentes')
      .then(res => res.json())
      .then(continentes => {
        filtroContinente.innerHTML = '<option value="">Selecciona un continente</option>';
        continentes.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.nombre;
          filtroContinente.appendChild(opt);
        });
        filtroContinente.disabled = false;
      });
  
    // ========== 2. Filtros en cascada ==========
    filtroContinente.addEventListener('change', function() {
      filtroPais.innerHTML = '<option value="">Selecciona un país</option>';
      filtroPais.disabled = true;
      filtroCiudad.innerHTML = '<option value="">Selecciona una ciudad</option>';
      filtroCiudad.disabled = true;
      selectHotel.innerHTML = '<option value="">Selecciona un hotel</option>';
      selectHotel.disabled = true;
      form.style.display = "none";
      mensajeDiv.textContent = "";
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
  
    filtroPais.addEventListener('change', function() {
      filtroCiudad.innerHTML = '<option value="">Selecciona una ciudad</option>';
      filtroCiudad.disabled = true;
      selectHotel.innerHTML = '<option value="">Selecciona un hotel</option>';
      selectHotel.disabled = true;
      form.style.display = "none";
      mensajeDiv.textContent = "";
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
  
    filtroCiudad.addEventListener('change', function() {
      selectHotel.innerHTML = '<option value="">Selecciona un hotel</option>';
      selectHotel.disabled = true;
      form.style.display = "none";
      mensajeDiv.textContent = "";
      if (this.value) {
        // 1. Traer hoteles de la ciudad
        fetch(`http://localhost:3000/api/hoteles-por-ciudad/${this.value}`)
          .then(res => res.json())
          .then(hoteles => {
            hotelesCargados = hoteles; // cache
            hoteles.forEach(h => {
              const opt = document.createElement('option');
              opt.value = h.id;
              opt.textContent = h.nombre;
              selectHotel.appendChild(opt);
            });
            selectHotel.disabled = false;
          });
        // 2. Traer zonas de la ciudad para los selects de zonas
        fetch(`http://localhost:3000/api/zonas/${this.value}`)
          .then(res => res.json())
          .then(zonas => {
            zonasCargadas = zonas;
            // Se cargan solo cuando cargues el hotel para evitar desordenar selects ahora
          });
      }
    });
  
    // ========== 3. Cargar datos del hotel seleccionado ==========
    selectHotel.addEventListener('change', function() {
      form.style.display = "none";
      mensajeDiv.textContent = "";
      if (!this.value) return;
      const hotel = hotelesCargados.find(h => h.id == this.value);
      if (!hotel) return;
  
      // Trae todos los datos del hotel con zonas/distancias
      fetch(`http://localhost:3000/api/hotel-detalle/${hotel.id}`)
        .then(res => res.json())
        .then(hotelFull => {
          // Prellenar form
          form.nombre.value = hotelFull.nombre;
          form.estrellas.value = hotelFull.estrellas;
          form.booking_score.value = hotelFull.booking_score;
          form.tripadvisor_score.value = hotelFull.tripadvisor_score;
          form.descripcion.value = hotelFull.descripcion;
          form.link_booking.value = hotelFull.link_booking;
          form.link_tripadvisor.value = hotelFull.link_tripadvisor;
  
          // Cargar selects de zonas
          selectZona1.innerHTML = '<option value="">Selecciona una zona</option>';
          selectZona2.innerHTML = '<option value="">Selecciona una zona</option>';
          zonasCargadas.forEach(z => {
            let opt1 = document.createElement('option');
            opt1.value = z.id;
            opt1.textContent = z.nombre;
            selectZona1.appendChild(opt1);
            let opt2 = document.createElement('option');
            opt2.value = z.id;
            opt2.textContent = z.nombre;
            selectZona2.appendChild(opt2);
          });
  
          // Poner zonas y metros
          if (hotelFull.zonas && hotelFull.zonas.length > 0) {
            form.id_zona1.value = hotelFull.zonas[0]?.id_zona || "";
            form.metros_zona1.value = hotelFull.zonas[0]?.metros || "";
            form.id_zona2.value = hotelFull.zonas[1]?.id_zona || "";
            form.metros_zona2.value = hotelFull.zonas[1]?.metros || "";
          } else {
            form.id_zona1.value = "";
            form.metros_zona1.value = "";
            form.id_zona2.value = "";
            form.metros_zona2.value = "";
          }
  
          form.style.display = "";
        });
    });
  
    // ========== 4. Guardar cambios ==========
    form.addEventListener('submit', function(e) {
      e.preventDefault();
  
      // Validación de zonas distintas
      if (form.id_zona1.value && form.id_zona2.value && form.id_zona1.value === form.id_zona2.value) {
        mensajeDiv.textContent = "No puedes seleccionar la misma zona dos veces.";
        mensajeDiv.style.color = "red";
        return;
      }
  
      // Recolecta zonas/distancias
      const zonas = [];
      if (form.id_zona1.value && form.metros_zona1.value) {
        zonas.push({ id_zona: form.id_zona1.value, metros: form.metros_zona1.value });
      }
      if (form.id_zona2.value && form.metros_zona2.value) {
        zonas.push({ id_zona: form.id_zona2.value, metros: form.metros_zona2.value });
      }
      if (zonas.length === 0) {
        mensajeDiv.textContent = "Debes seleccionar al menos una zona y su distancia.";
        mensajeDiv.style.color = "red";
        return;
      }
  
      // Armar payload para actualizar
      const data = {
        nombre: form.nombre.value,
        estrellas: form.estrellas.value,
        booking_score: form.booking_score.value,
        tripadvisor_score: form.tripadvisor_score.value,
        descripcion: form.descripcion.value,
        link_booking: form.link_booking.value,
        link_tripadvisor: form.link_tripadvisor.value,
        zonas: zonas
      };
  
      const hotelId = selectHotel.value;
  
      fetch(`http://localhost:3000/api/hotel/${hotelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      .then(res => res.json())
      .then(resp => {
        if (resp.success) {
          mensajeDiv.textContent = "Hotel actualizado correctamente.";
          mensajeDiv.style.color = "green";
        } else {
          mensajeDiv.textContent = resp.error || "Error al actualizar.";
          mensajeDiv.style.color = "red";
        }
      });
    });
  });
  