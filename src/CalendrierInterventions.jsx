// src/CalendrierInterventions.jsx
import { useEffect, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { supabase } from './lib/supabaseClient';
import {
  generateProjectColors,
  generateInterventionColors
} from './utils/colorUtils';
import ThreeMonthGrid from './ThreeMonthGrid'; // <- Import composant custom

const localizer = momentLocalizer(moment);

const CalendrierInterventions = ({
  projets,
  onSelectIntervention,
  viewMode
}) => {
  const [events, setEvents] = useState([]);
  const [intervColors, setIntervColors] = useState({});
  const [view, setView] = useState(viewMode);

  useEffect(() => {
    setView(viewMode === '3months' ? 'month' : viewMode);
  }, [viewMode]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('interventions')
        .select('id, lot_id, date, date_fin, heure_debut, heure_fin, lots(id, nom, projet_id, projets(id, nom))');
      if (error) return console.error(error);

      const projColors = generateProjectColors(projets);
      const shades = generateInterventionColors(
        data.map(item => ({ id: item.id, lots: { projet_id: item.lots?.projet_id } })),
        projColors
      );
      setIntervColors(shades);

      const evts = data.map(item => ({
        id: item.id,
        title: `Intervention`,
        start: new Date(`${item.date}T${item.heure_debut}`),
        end: new Date(`${(item.date_fin || item.date)}T${item.heure_fin}`),
        raw: item
      }));
      setEvents(evts);
    })();
  }, [projets]);

  const eventStyleGetter = event => ({
    style: {
      backgroundColor: intervColors[event.id] || '#3174ad',
      borderRadius: 4,
      opacity: 0.9,
      color: 'white',
      border: 0
    }
  });

  if (viewMode === '3months') {
    return (
      <ThreeMonthGrid
        interventions={events.map(e => e.raw)}
        projets={projets}
        onSelectIntervention={onSelectIntervention}
      />
    );
  }

  return (
    <div style={{ height: '600px' }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        view={view}
        onView={setView}
        views={['month','week','day','agenda']}
        defaultView={view}
        style={{ height: '100%' }}
        eventPropGetter={eventStyleGetter}
        onSelectEvent={e => onSelectIntervention(e.raw)}
        selectable
        onDoubleClickSlot={slot => {
          const start = slot.start;
          const end = slot.end;
          onSelectIntervention({
            date: moment(start).format('YYYY-MM-DD'),
            date_fin: moment(end).format('YYYY-MM-DD'),
            heure_debut: moment(start).format('HH:mm'),
            heure_fin: moment(end).format('HH:mm'),
            lot_id: null
          });
        }}
        min={new Date(1970, 1, 1, 8, 0)}
        max={new Date(1970, 1, 1, 20, 0)}
      />
    </div>
  );
};

export default CalendrierInterventions;
