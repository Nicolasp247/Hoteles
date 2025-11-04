// ============================================================
// Anadir Hoteles
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    const selectContinente = document.getElementById('select-continente');
    const selectPais = document.getElementById('select-pais');
    const selectCiudad = document.getElementById('select-ciudad');
    const selectZona1 = document.getElementById('select-zona1');
    const selectZona2 = document.getElementById('select-zona2');
    const formHotel = document.getElementById('form-anadir-hotel');
  
    // 1. Cargar continentes
    fetch('http://localhost:3000/api/continentes')
      .then(res => res.json())
      .then(continentes => {
        selectContinente.innerHTML = '<option value="">Selecciona un continente</option>';
        continentes.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.nombre;
          selectContinente.appendChild(opt);
        });
        selectContinente.disabled = false;
      });
  
    // 2. Cuando elija continente, cargar países
    selectContinente.addEventListener('change', function() {
      selectPais.innerHTML = '<option value="">Selecciona un país</option>';
      selectPais.disabled = true;
      selectCiudad.innerHTML = '<option value="">Selecciona una ciudad</option>';
      selectCiudad.disabled = true;
      // Aquí limpiamos ambos selects de zona
      selectZona1.innerHTML = '<option value="">Selecciona una zona</option>';
      selectZona1.disabled = true;
      selectZona2.innerHTML = '<option value="">Selecciona una zona</option>';
      selectZona2.disabled = true;
  
      if (this.value) {
        fetch(`http://localhost:3000/api/paises/${this.value}`)
          .then(res => res.json())
          .then(paises => {
            paises.forEach(p => {
              const opt = document.createElement('option');
              opt.value = p.id;
              opt.textContent = p.nombre;
              selectPais.appendChild(opt);
            });
            selectPais.disabled = false;
          });
      }
    });
  
    // 3. Cuando elija país, cargar ciudades
    selectPais.addEventListener('change', function() {
      selectCiudad.innerHTML = '<option value="">Selecciona una ciudad</option>';
      selectCiudad.disabled = true;
      selectZona1.innerHTML = '<option value="">Selecciona una zona</option>';
      selectZona1.disabled = true;
      selectZona2.innerHTML = '<option value="">Selecciona una zona</option>';
      selectZona2.disabled = true;
  
      if (this.value) {
        fetch(`http://localhost:3000/api/ciudades/${this.value}`)
          .then(res => res.json())
          .then(ciudades => {
            ciudades.forEach(c => {
              const opt = document.createElement('option');
              opt.value = c.id;
              opt.textContent = c.nombre;
              selectCiudad.appendChild(opt);
            });
            selectCiudad.disabled = false;
          });
      }
    });
  
    // 4. Cuando elija ciudad, cargar zonas (en ambos selects)
    selectCiudad.addEventListener('change', function() {
      selectZona1.innerHTML = '<option value="">Selecciona una zona</option>';
      selectZona1.disabled = true;
      selectZona2.innerHTML = '<option value="">Selecciona una zona</option>';
      selectZona2.disabled = true;

      if (this.value) {
        // Asignar el valor seleccionado al campo oculto
        document.getElementById('input-id-ciudad').value = this.value;

        fetch(`http://localhost:3000/api/zonas/${this.value}`)
          .then(res => res.json())
          .then(zonas => {
            zonas.forEach(z => {
              const opt1 = document.createElement('option');
              opt1.value = z.id;
              opt1.textContent = z.nombre;
              selectZona1.appendChild(opt1);

              const opt2 = document.createElement('option');
              opt2.value = z.id;
              opt2.textContent = z.nombre;
              selectZona2.appendChild(opt2);
            });
            selectZona1.disabled = false;
            selectZona2.disabled = false;
          });
      }
    });

  
    // 5. Manejo del formulario
    if (formHotel) {
      formHotel.addEventListener('submit', function(e) {
        e.preventDefault();
  
        // Validar que no elija la misma zona dos veces
        if (
          formHotel.id_zona1.value &&
          formHotel.id_zona2.value &&
          formHotel.id_zona1.value === formHotel.id_zona2.value
        ) {
          const mensajeDiv = document.getElementById('mensaje');
          mensajeDiv.textContent = "No puedes seleccionar la misma zona dos veces.";
          mensajeDiv.style.color = "red";
          return;
        }
  
        const data = {
          nombre: formHotel.nombre.value,
          estrellas: formHotel.estrellas.value,
          booking_score: formHotel.booking_score.value,
          tripadvisor_score: formHotel.tripadvisor_score.value,
          descripcion: formHotel.descripcion.value,
          link_booking: formHotel.link_booking.value,
          link_tripadvisor: formHotel.link_tripadvisor.value,
          id_ciudad: selectCiudad.value,
          zonas: []
        };
        // Zona 1 (obligatoria)
        if (formHotel.id_zona1.value && formHotel.metros_zona1.value) {
          data.zonas.push({
            id_zona: formHotel.id_zona1.value,
            metros: formHotel.metros_zona1.value
          });
        }
        // Zona 2 (opcional)
        if (formHotel.id_zona2.value && formHotel.metros_zona2.value) {
          data.zonas.push({
            id_zona: formHotel.id_zona2.value,
            metros: formHotel.metros_zona2.value
          });
        }
  
        fetch('http://localhost:3000/api/hotel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(data => {
          const mensajeDiv = document.getElementById('mensaje');
          if (data.success) {
            mensajeDiv.textContent = "¡Hotel guardado con éxito!";
            mensajeDiv.style.color = "green";
            formHotel.reset();
            selectPais.disabled = true;
            selectCiudad.disabled = true;
            selectZona1.disabled = true;
            selectZona2.disabled = true;
          } else {
            mensajeDiv.textContent = data.error || JSON.stringify(data);

            mensajeDiv.style.color = "red";
          }
        });
      });
    }
  });
  