import { FilloutModal } from "notionclub-infra";

// Modale overlay (position fixed plein écran) embarquant un formulaire Fillout
// en iframe. L'iframe peut rester vide en preview — on montre le chrome de la
// modale (barre macOS + cadre). Nécessite probablement cardMode:single.
export const Booking = () => (
  <FilloutModal
    isOpen
    onClose={() => {}}
    baseUrl="https://forms.fillout.com/t/coaching-notionclub"
    id="call-demo"
    mail="theo@notionclub.fr"
    prenom="Théo"
    nom="Martin"
  />
);
